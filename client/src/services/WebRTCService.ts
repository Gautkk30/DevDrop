import type { ConnectionType, NetworkStats, QualityRating } from '../shared/types.js';

export interface PeerConnectionHandlers {
  onDataChannel?: (peerId: string, channel: RTCDataChannel) => void;
  onIceCandidate?: (peerId: string, candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (peerId: string, state: RTCPeerConnectionState) => void;
  onStatsUpdate?: (peerId: string, stats: NetworkStats) => void;
}

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private statsTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private iceServers: RTCIceServer[];

  constructor() {
    this.iceServers = this.parseIceServers();
  }

  private parseIceServers(): RTCIceServer[] {
    const stunString = import.meta.env.VITE_STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';
    const stunUrls = stunString.split(',').map((s) => s.trim()).filter(Boolean);

    const servers: RTCIceServer[] = [
      { urls: stunUrls }
    ];

    const turnUrl = import.meta.env.VITE_TURN_URL;
    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: import.meta.env.VITE_TURN_USERNAME || '',
        credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
      });
    }

    return servers;
  }

  public createPeerConnection(peerId: string, handlers: PeerConnectionHandlers): RTCPeerConnection {
    this.closePeerConnection(peerId);

    const config: RTCConfiguration = {
      iceServers: this.iceServers,
      iceTransportPolicy: 'all',
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && handlers.onIceCandidate) {
        handlers.onIceCandidate(peerId, event.candidate);
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.dataChannels.set(peerId, channel);
      if (handlers.onDataChannel) {
        handlers.onDataChannel(peerId, channel);
      }
    };

    pc.onconnectionstatechange = () => {
      if (handlers.onConnectionStateChange) {
        handlers.onConnectionStateChange(peerId, pc.connectionState);
      }
      if (pc.connectionState === 'connected') {
        this.startStatsMonitoring(peerId, handlers.onStatsUpdate);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.stopStatsMonitoring(peerId);
      }
    };

    return pc;
  }

  public createDataChannel(peerId: string, label: string = 'devdrop-file-channel'): RTCDataChannel {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    const channel = pc.createDataChannel(label, {
      ordered: true,
    });
    channel.binaryType = 'arraybuffer';
    this.dataChannels.set(peerId, channel);

    return channel;
  }

  public async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  public async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[WebRTCService] Error adding ICE candidate for ${peerId}:`, err);
    }
  }

  public getDataChannel(peerId: string): RTCDataChannel | undefined {
    return this.dataChannels.get(peerId);
  }

  public closePeerConnection(peerId: string): void {
    this.stopStatsMonitoring(peerId);

    const channel = this.dataChannels.get(peerId);
    if (channel) {
      try { channel.close(); } catch (e) {}
      this.dataChannels.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try { pc.close(); } catch (e) {}
      this.peerConnections.delete(peerId);
    }
  }

  private startStatsMonitoring(peerId: string, onStatsUpdate?: (peerId: string, stats: NetworkStats) => void): void {
    this.stopStatsMonitoring(peerId);

    let lastBytesSent = 0;
    let lastBytesReceived = 0;
    let lastTime = Date.now();

    const ratingHistory: QualityRating[] = [];

    const interval = setInterval(async () => {
      const pc = this.peerConnections.get(peerId);
      if (!pc || pc.connectionState !== 'connected') {
        this.stopStatsMonitoring(peerId);
        return;
      }

      try {
        const statsReport = await pc.getStats();
        let connectionType: ConnectionType = 'unknown';
        let rttMs = 0;
        let localCandidateStats: any = null;
        let remoteCandidateStats: any = null;
        let totalBytesTransferred = 0;

        statsReport.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && (report.nominated || !localCandidateStats)) {
            rttMs = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : 0;

            const anyReport = statsReport as any;
            const local = typeof anyReport.get === 'function' ? anyReport.get(report.localCandidateId) : null;
            const remote = typeof anyReport.get === 'function' ? anyReport.get(report.remoteCandidateId) : null;

            if (local) localCandidateStats = local;
            if (remote) remoteCandidateStats = remote;

            if (local && remote) {
              const localType = (local as any).candidateType;
              const remoteType = (remote as any).candidateType;

              if (localType === 'relay' || remoteType === 'relay') {
                connectionType = 'relayed';
              } else if (localType === 'host' && remoteType === 'host') {
                connectionType = 'direct-local';
              } else {
                connectionType = 'direct-internet';
              }
            }
          }

          if (report.type === 'data-channel') {
            totalBytesTransferred += (report.bytesSent || 0) + (report.bytesReceived || 0);
          }
        });

        const now = Date.now();
        const timeDiffSec = (now - lastTime) / 1000;
        lastTime = now;

        const currentThroughput = timeDiffSec > 0 ? (totalBytesTransferred - (lastBytesSent + lastBytesReceived)) / timeDiffSec : 0;
        lastBytesSent = totalBytesTransferred;

        const channel = this.dataChannels.get(peerId);
        const bufferedAmount = channel ? channel.bufferedAmount : 0;

        const instantRating = this.calculateRating(rttMs, connectionType);
        ratingHistory.push(instantRating);
        if (ratingHistory.length > 3) ratingHistory.shift();

        // Smoothed rating (majority vote in 3-sample window)
        const smoothedRating = this.smoothRating(ratingHistory);

        const stats: NetworkStats = {
          rttMs,
          throughputBytesPerSec: Math.max(0, currentThroughput),
          averageThroughputBytesPerSec: Math.max(0, currentThroughput),
          bufferedAmountBytes: bufferedAmount,
          connectionType,
          rating: smoothedRating,
          candidatePair: localCandidateStats && remoteCandidateStats
            ? {
                localType: (localCandidateStats as any).candidateType || 'host',
                remoteType: (remoteCandidateStats as any).candidateType || 'host',
                localAddress: (localCandidateStats as any).address || (localCandidateStats as any).ip,
                remoteAddress: (remoteCandidateStats as any).address || (remoteCandidateStats as any).ip,
              }
            : undefined,
        };

        if (onStatsUpdate) {
          onStatsUpdate(peerId, stats);
        }
      } catch (err) {
        console.warn(`[WebRTCService] Error reading stats for ${peerId}:`, err);
      }
    }, 1000);

    this.statsTimers.set(peerId, interval);
  }

  private stopStatsMonitoring(peerId: string): void {
    const timer = this.statsTimers.get(peerId);
    if (timer) {
      clearInterval(timer);
      this.statsTimers.delete(peerId);
    }
  }

  private calculateRating(rttMs: number, type: ConnectionType): QualityRating {
    if (type === 'unknown') return 'poor';
    if (rttMs <= 40 && type === 'direct-local') return 'excellent';
    if (rttMs <= 100) return 'good';
    if (rttMs <= 250) return 'fair';
    return 'poor';
  }

  private smoothRating(history: QualityRating[]): QualityRating {
    if (history.length === 0) return 'good';
    const counts: Record<string, number> = {};
    history.forEach((r) => {
      counts[r] = (counts[r] || 0) + 1;
    });

    let bestRating: QualityRating = history[history.length - 1];
    let maxCount = 0;
    for (const [r, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        bestRating = r as QualityRating;
      }
    }
    return bestRating;
  }
}

export const webrtcService = new WebRTCService();

