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
  private channelReadyResolvers: Map<string, Array<(channel: RTCDataChannel) => void>> = new Map();
  private peerHandlers: Map<string, PeerConnectionHandlers> = new Map();
  private iceServers: RTCIceServer[];

  constructor() {
    this.iceServers = this.parseIceServers();
    console.log('[WebRTCService] Initialized with ICE servers:', this.iceServers.map((s) => s.urls));
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

  public getPeerConnection(peerId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(peerId);
  }

  public getPeerConnectionState(peerId: string): RTCPeerConnectionState | 'none' {
    const pc = this.peerConnections.get(peerId);
    return pc ? pc.connectionState : 'none';
  }

  public getDataChannel(peerId: string): RTCDataChannel | undefined {
    return this.dataChannels.get(peerId);
  }

  public getDataChannelState(peerId: string): RTCDataChannelState | 'none' {
    const ch = this.dataChannels.get(peerId);
    return ch ? ch.readyState : 'none';
  }

  public isDataChannelOpen(peerId: string): boolean {
    const ch = this.dataChannels.get(peerId);
    return !!ch && ch.readyState === 'open';
  }

  public async waitForDataChannel(peerId: string, timeoutMs = 15000): Promise<RTCDataChannel> {
    const existing = this.dataChannels.get(peerId);
    if (existing && existing.readyState === 'open') {
      console.log(`[WebRTC:${peerId}] waitForDataChannel: DataChannel is already OPEN`);
      return existing;
    }

    console.log(
      `[WebRTC:${peerId}] waitForDataChannel: waiting up to ${timeoutMs}ms for DataChannel to reach OPEN state (current state: ${existing ? existing.readyState : 'NONE'})`
    );

    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const onOpenHandler = (channel: RTCDataChannel) => {
        if (timer) clearTimeout(timer);
        console.log(`[WebRTC:${peerId}] waitForDataChannel: successfully reached OPEN state (label="${channel.label}")`);
        resolve(channel);
      };

      timer = setTimeout(() => {
        // Clean up resolver
        const list = this.channelReadyResolvers.get(peerId);
        if (list) {
          this.channelReadyResolvers.set(peerId, list.filter((cb) => cb !== onOpenHandler));
        }

        const pc = this.peerConnections.get(peerId);
        const ch = this.dataChannels.get(peerId);
        const pcState = pc ? `pcState=${pc.connectionState}, iceState=${pc.iceConnectionState}, sigState=${pc.signalingState}` : 'no-pc';
        const chState = ch ? `chState=${ch.readyState}` : 'no-channel';
        const errorMsg = `DataChannel timeout (${timeoutMs / 1000}s) for peer ${peerId} [${pcState}, ${chState}]`;
        console.error(`[WebRTC:${peerId}] ${errorMsg}`);
        reject(new Error(errorMsg));
      }, timeoutMs);

      if (!this.channelReadyResolvers.has(peerId)) {
        this.channelReadyResolvers.set(peerId, []);
      }
      this.channelReadyResolvers.get(peerId)!.push(onOpenHandler);
    });
  }

  public createPeerConnection(peerId: string, handlers: PeerConnectionHandlers): RTCPeerConnection {
    this.closePeerConnection(peerId);
    this.peerHandlers.set(peerId, handlers);

    console.log(`[WebRTC:${peerId}] Creating RTCPeerConnection...`);

    const config: RTCConfiguration = {
      iceServers: this.iceServers,
      iceTransportPolicy: 'all',
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC:${peerId}] Generated local ICE candidate: ${event.candidate.candidate.substring(0, 40)}...`);
        if (handlers.onIceCandidate) {
          handlers.onIceCandidate(peerId, event.candidate);
        }
      } else {
        console.log(`[WebRTC:${peerId}] ICE candidate gathering complete`);
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log(`[WebRTC:${peerId}] ondatachannel event received: label="${channel.label}" readyState="${channel.readyState}"`);
      this.bindDataChannel(peerId, channel, handlers);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC:${peerId}] RTCPeerConnection state change: ${pc.connectionState}`);
      if (handlers.onConnectionStateChange) {
        handlers.onConnectionStateChange(peerId, pc.connectionState);
      }
      if (pc.connectionState === 'connected') {
        this.startStatsMonitoring(peerId, handlers.onStatsUpdate);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.stopStatsMonitoring(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC:${peerId}] ICE connection state change: ${pc.iceConnectionState}`);
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC:${peerId}] Signaling state change: ${pc.signalingState}`);
    };

    return pc;
  }

  public createDataChannel(peerId: string, label: string = 'devdrop-file-channel'): RTCDataChannel {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    console.log(`[WebRTC:${peerId}] Proactively creating RTCDataChannel with label="${label}"`);

    const channel = pc.createDataChannel(label, {
      ordered: true,
    });

    const handlers = this.peerHandlers.get(peerId);
    this.bindDataChannel(peerId, channel, handlers);

    return channel;
  }

  public bindDataChannel(peerId: string, channel: RTCDataChannel, handlers?: PeerConnectionHandlers): void {
    channel.binaryType = 'arraybuffer';
    this.dataChannels.set(peerId, channel);

    console.log(`[WebRTC:${peerId}] Binding DataChannel: label="${channel.label}" readyState="${channel.readyState}"`);

    const notifyReady = () => {
      console.log(`[WebRTC:${peerId}] DataChannel onopen: channel is now OPEN and ready for transfer (label="${channel.label}")`);
      const resolvers = this.channelReadyResolvers.get(peerId);
      if (resolvers && resolvers.length > 0) {
        this.channelReadyResolvers.delete(peerId);
        resolvers.forEach((cb) => cb(channel));
      }
    };

    if (channel.readyState === 'open') {
      setTimeout(notifyReady, 0);
    } else {
      channel.onopen = () => {
        notifyReady();
      };
    }

    channel.onclose = () => {
      console.log(`[WebRTC:${peerId}] DataChannel onclose: channel closed`);
    };

    channel.onerror = (err) => {
      console.error(`[WebRTC:${peerId}] DataChannel onerror:`, err);
    };

    if (handlers?.onDataChannel) {
      handlers.onDataChannel(peerId, channel);
    }
  }

  public async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    console.log(`[WebRTC:${peerId}] Creating SDP offer...`);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log(`[WebRTC:${peerId}] SDP offer created and set as local description`);
    return offer;
  }

  public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    console.log(`[WebRTC:${peerId}] Handling incoming SDP offer...`);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log(`[WebRTC:${peerId}] SDP answer created and set as local description`);
    return answer;
  }

  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) throw new Error(`RTCPeerConnection not found for peer ${peerId}`);

    console.log(`[WebRTC:${peerId}] Handling incoming SDP answer...`);
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log(`[WebRTC:${peerId}] SDP answer set as remote description`);
  }

  public async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) return;

    try {
      console.log(`[WebRTC:${peerId}] Adding remote ICE candidate: ${candidate.candidate?.substring(0, 40)}...`);
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[WebRTC:${peerId}] Error adding ICE candidate:`, err);
    }
  }

  public closePeerConnection(peerId: string): void {
    if (peerId === '*') {
      Array.from(this.peerConnections.keys()).forEach((pId) => this.closePeerConnection(pId));
      return;
    }

    console.log(`[WebRTC:${peerId}] Closing peer connection and cleanup...`);
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

    this.peerHandlers.delete(peerId);
    this.channelReadyResolvers.delete(peerId);
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
        console.warn(`[WebRTC:${peerId}] Error reading stats:`, err);
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
