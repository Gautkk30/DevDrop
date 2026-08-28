import { useEffect, useState, useRef, useCallback } from 'react';
import { signalingClient } from './services/SignalingClient.js';
import { webrtcService } from './services/WebRTCService.js';
import type { ActiveTransfer } from './services/TransferEngine.js';
import { TransferEngine, CHUNK_SIZE } from './services/TransferEngine.js';
import type { DeviceInfo, RoomMetadata, NetworkStats, TransferMetadata } from './shared/types.js';

import { Header } from './components/Header.tsx';
import { LandingView } from './components/LandingView.tsx';
import { RoomDashboard } from './components/RoomDashboard.tsx';
import { CreateRoomModal } from './components/CreateRoomModal.tsx';
import { JoinRoomModal } from './components/JoinRoomModal.tsx';
import { QrScannerModal } from './components/QrScannerModal.tsx';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer.tsx';
import { FileSecurityModal } from './components/FileSecurityModal.tsx';
import { FilePreviewModal } from './components/FilePreviewModal.tsx';
import { ToastContainer, type ToastItem } from './components/ToastContainer.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { PreTransferModal } from './components/PreTransferModal.tsx';
import { ErrorRecoveryModal, type ErrorRecoveryDetails } from './components/ErrorRecoveryModal.tsx';

export function App() {
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null);
  const [room, setRoom] = useState<RoomMetadata | null>(null);
  const [peers, setPeers] = useState<DeviceInfo[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);

  const [transfers, setTransfers] = useState<ActiveTransfer[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [joinInitialCode, setJoinInitialCode] = useState('');

  const [stagingFiles, setStagingFiles] = useState<File[]>([]);
  const [stagingTargets, setStagingTargets] = useState<string[]>([]);
  const [isStagingOpen, setIsStagingOpen] = useState(false);

  const [errorRecovery, setErrorRecovery] = useState<ErrorRecoveryDetails | null>(null);
  const [securityModalMetadata, setSecurityModalMetadata] = useState<TransferMetadata | null>(null);
  const [previewTransfer, setPreviewTransfer] = useState<ActiveTransfer | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const [pwaEvent, setPwaEvent] = useState<any>(null);

  const activeTransfersMap = useRef<Map<string, ActiveTransfer>>(new Map());

  const addToast = useCallback((title: string, message?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Global Keyboard Shortcuts (Ctrl/Cmd + K for Command Palette, Escape for Modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCreateOpen(false);
        setIsJoinOpen(false);
        setIsScannerOpen(false);
        setIsDiagnosticsOpen(false);
        setIsCommandPaletteOpen(false);
        setIsStagingOpen(false);
        setSecurityModalMetadata(null);
        setPreviewTransfer(null);
        setErrorRecovery(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setPwaEvent(e);
    });

    const path = window.location.pathname;
    if (path.includes('/join/')) {
      const code = path.split('/join/')[1];
      if (code) {
        setJoinInitialCode(code.toUpperCase());
        setIsJoinOpen(true);
      }
    }

    signalingClient.connect().catch((err) => {
      console.warn('[App] Signaling connection error:', err);
      addToast('Connection Error', 'Failed to reach signaling server. Trying to reconnect...', 'error');
    });

    const unsubCreated = signalingClient.on('ROOM_CREATED', (msg) => {
      if (msg.payload) {
        setRoom(msg.payload.room);
        setCurrentDevice(msg.payload.device);
        setPeers(msg.payload.peers || [msg.payload.device]);
        setIsCreateOpen(false);
        addToast('Room Ready', `Created room ${msg.payload.room.code}`, 'success');
      }
    });

    const unsubJoined = signalingClient.on('ROOM_JOINED', (msg) => {
      if (msg.payload) {
        setRoom(msg.payload.room);
        setCurrentDevice(msg.payload.device);
        setPeers(msg.payload.peers || []);
        setIsJoinOpen(false);
        addToast('Joined Room', `Connected to room ${msg.payload.room.code}`, 'success');
      }
    });

    const unsubPeerJoined = signalingClient.on('PEER_JOINED', (msg) => {
      if (msg.payload?.device) {
        const newDevice = msg.payload.device;
        setPeers((prev) => [...prev.filter((p) => p.id !== newDevice.id), newDevice]);
        addToast('Device Connected', `${newDevice.name} joined the room`, 'info');

        if (currentDevice && currentDevice.id < newDevice.id) {
          initiateWebRTCConnection(newDevice.id);
        }
      }
    });

    const unsubPeerLeft = signalingClient.on('PEER_LEFT', (msg) => {
      if (msg.payload?.deviceId) {
        const leftId = msg.payload.deviceId;
        const leftDevice = msg.payload.leftDevice;
        setPeers((prev) => prev.filter((p) => p.id !== leftId));
        webrtcService.closePeerConnection(leftId);
        if (leftDevice) {
          addToast('Device Disconnected', `${leftDevice.name} left the room`, 'warning');
        }
      }
    });

    const unsubOffer = signalingClient.on('SIGNAL_OFFER', async (msg) => {
      if (msg.senderDeviceId && msg.payload?.sdp) {
        const peerId = msg.senderDeviceId;
        setupPeerConnection(peerId);
        const answer = await webrtcService.handleOffer(peerId, msg.payload.sdp);
        signalingClient.send({
          type: 'SIGNAL_ANSWER',
          targetDeviceId: peerId,
          payload: { sdp: answer },
        });
      }
    });

    const unsubAnswer = signalingClient.on('SIGNAL_ANSWER', async (msg) => {
      if (msg.senderDeviceId && msg.payload?.sdp) {
        await webrtcService.handleAnswer(msg.senderDeviceId, msg.payload.sdp);
      }
    });

    const unsubIce = signalingClient.on('SIGNAL_ICE', async (msg) => {
      if (msg.senderDeviceId && msg.payload?.candidate) {
        await webrtcService.addIceCandidate(msg.senderDeviceId, msg.payload.candidate);
      }
    });

    const unsubTransferOffer = signalingClient.on('TRANSFER_OFFER', (msg) => {
      if (msg.payload?.metadata) {
        const metadata: TransferMetadata = msg.payload.metadata;

        if (metadata.isExecutableRisk) {
          setSecurityModalMetadata(metadata);
        } else {
          autoAcceptTransferOffer(metadata);
        }
      }
    });

    const unsubTransferAccept = signalingClient.on('TRANSFER_ACCEPT', (msg) => {
      if (msg.payload?.transferId) {
        startSendingTransfer(msg.payload.transferId);
      }
    });

    const unsubTransferCancel = signalingClient.on('TRANSFER_CANCEL', (msg) => {
      if (msg.payload?.transferId) {
        const t = activeTransfersMap.current.get(msg.payload.transferId);
        if (t) {
          t.status = 'cancelled';
          t.receivedChunks = [];
          updateTransferState(t);
          addToast('Transfer Cancelled', `Peer cancelled ${t.metadata.fileName}`, 'warning');
        }
      }
    });

    const unsubExpired = signalingClient.on('ROOM_EXPIRED', () => {
      setRoom(null);
      setPeers([]);
      setErrorRecovery({
        title: 'Room Expired',
        message: 'This ephemeral transfer room reached its expiration limit and has been securely cleaned up.',
        recoveryActionLabel: 'Create New Room',
        onRecover: () => setIsCreateOpen(true),
      });
    });

    return () => {
      unsubCreated();
      unsubJoined();
      unsubPeerJoined();
      unsubPeerLeft();
      unsubOffer();
      unsubAnswer();
      unsubIce();
      unsubTransferOffer();
      unsubTransferAccept();
      unsubTransferCancel();
      unsubExpired();
    };
  }, [currentDevice, addToast]);

  const setupPeerConnection = (peerId: string) => {
    return webrtcService.createPeerConnection(peerId, {
      onIceCandidate: (pId, candidate) => {
        signalingClient.send({
          protocolVersion: 1,
          type: 'SIGNAL_ICE',
          targetDeviceId: pId,
          payload: { candidate },
        });
      },
      onDataChannel: (pId, channel) => {
        setupDataChannelHandlers(pId, channel);
      },
      onConnectionStateChange: (pId, state) => {
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          const activeList = Array.from(activeTransfersMap.current.values());
          activeList.forEach((t) => {
            if (
              (t.metadata.senderDeviceId === pId || t.metadata.targetDeviceIds.includes(pId)) &&
              (t.status === 'transferring' || t.status === 'offering')
            ) {
              t.status = 'failed';
              t.error = `WebRTC transport connection ${state}`;
              updateTransferState(t);
            }
          });
        }
      },
      onStatsUpdate: (_, stats) => {
        setNetworkStats(stats);
      },
    });
  };

  const initiateWebRTCConnection = async (peerId: string) => {
    setupPeerConnection(peerId);
    const dataChannel = webrtcService.createDataChannel(peerId);
    setupDataChannelHandlers(peerId, dataChannel);

    const offer = await webrtcService.createOffer(peerId);
    signalingClient.send({
      type: 'SIGNAL_OFFER',
      targetDeviceId: peerId,
      payload: { sdp: offer },
    });
  };

  const setupDataChannelHandlers = (peerId: string, channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    channel.onmessage = async (event) => {
      if (typeof event.data !== 'string') {
        const chunk = new Uint8Array(event.data as ArrayBuffer);
        handleIncomingBinaryChunk(peerId, chunk);
      }
    };
  };

  const handleIncomingBinaryChunk = (peerId: string, chunk: Uint8Array) => {
    const activeList = Array.from(activeTransfersMap.current.values());
    const targetTransfer = activeList.find(
      (t) => t.metadata.senderDeviceId === peerId && t.status === 'transferring'
    );

    if (!targetTransfer) return;

    try {
      const rawArrayBuffer = (chunk.buffer as ArrayBuffer).slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      const { chunkIndex, totalChunks, payload } = TransferEngine.unframeChunk(rawArrayBuffer);

      if (!targetTransfer.receivedChunks) {
        targetTransfer.receivedChunks = new Array(totalChunks);
      }

      // Store chunk payload as Uint8Array / BlobPart
      targetTransfer.receivedChunks[chunkIndex] = payload as unknown as BlobPart;
      targetTransfer.bytesTransferred += payload.byteLength;
      targetTransfer.currentChunkIndex = chunkIndex + 1;

      const now = Date.now();
      const elapsedSec = (now - (targetTransfer.startTime || now)) / 1000;
      const instantSpeed = elapsedSec > 0 ? targetTransfer.bytesTransferred / elapsedSec : 0;
      targetTransfer.speedBytesPerSec = TransferEngine.smoothSpeed(targetTransfer.speedBytesPerSec, instantSpeed);
      targetTransfer.averageSpeedBytesPerSec = instantSpeed;

      const remainingBytes = Math.max(0, targetTransfer.metadata.fileSize - targetTransfer.bytesTransferred);
      targetTransfer.etaSeconds = targetTransfer.speedBytesPerSec > 0 ? remainingBytes / targetTransfer.speedBytesPerSec : 0;
      targetTransfer.progressPercent = Math.min(100, Math.round((targetTransfer.bytesTransferred / targetTransfer.metadata.fileSize) * 100));

      if (targetTransfer.bytesTransferred >= targetTransfer.metadata.fileSize || targetTransfer.currentChunkIndex >= totalChunks) {
        targetTransfer.status = 'verifying';
        updateTransferState(targetTransfer);
        verifyCompletedTransfer(targetTransfer);
      } else {
        updateTransferState(targetTransfer);
      }
    } catch (err: any) {
      console.error('[App] Chunk framing error:', err);
    }
  };

  const verifyCompletedTransfer = async (transfer: ActiveTransfer) => {
    if (!transfer.receivedChunks) return;

    try {
      const blob = new Blob(transfer.receivedChunks, { type: transfer.metadata.fileType });
      const buffer = await blob.arrayBuffer();
      const computedHash = await TransferEngine.computeSha256(buffer);

      if (!transfer.metadata.sha256Checksum || computedHash === transfer.metadata.sha256Checksum) {
        transfer.verified = true;
        transfer.status = 'completed';
        updateTransferState(transfer);
        addToast('Transfer Complete', `Received ${transfer.metadata.fileName} (${TransferEngine.formatBytes(transfer.metadata.fileSize)})`, 'success');
      } else {
        transfer.verified = false;
        transfer.status = 'failed';
        transfer.error = 'SHA-256 integrity verification failed: file corrupted during peer-to-peer transmission';
        updateTransferState(transfer);
        addToast('Verification Failed', 'SHA-256 checksum mismatch — file integrity failed', 'error');
      }
    } catch (err: any) {
      transfer.verified = false;
      transfer.status = 'failed';
      transfer.error = 'Failed to verify file integrity: ' + err.message;
      updateTransferState(transfer);
      addToast('Integrity Error', err.message, 'error');
    }
  };

  const updateTransferState = (transfer: ActiveTransfer) => {
    activeTransfersMap.current.set(transfer.metadata.transferId, { ...transfer });
    setTransfers(Array.from(activeTransfersMap.current.values()));
  };

  const handleCreateRoom = (options: { deviceName: string; deviceType: any; password?: string; isOneTime: boolean }) => {
    const deviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
    signalingClient.send({
      protocolVersion: 1,
      type: 'ROOM_CREATE',
      payload: {
        password: options.password,
        isOneTime: options.isOneTime,
        device: {
          id: deviceId,
          name: options.deviceName,
          type: options.deviceType,
        },
      },
    });
  };

  const handleJoinRoom = (options: { roomCode: string; deviceName: string; deviceType: any; password?: string }) => {
    const deviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
    signalingClient.send({
      protocolVersion: 1,
      type: 'ROOM_JOIN',
      payload: {
        roomCode: options.roomCode,
        password: options.password,
        device: {
          id: deviceId,
          name: options.deviceName,
          type: options.deviceType,
        },
      },
    });
  };

  const handleSendFile = async (file: File, targetDeviceIds: string[]) => {
    if (!currentDevice) return;

    const transferId = 'tr_' + Math.random().toString(36).substring(2, 9);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const isRisky = TransferEngine.isExecutableRisk(file.name);

    // Compute SHA-256 over the entire file
    const sha256Checksum = await TransferEngine.computeFileSha256(file);

    const metadata: TransferMetadata = {
      transferId,
      senderDeviceId: currentDevice.id,
      senderDeviceName: currentDevice.name,
      targetDeviceIds,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      totalChunks,
      chunkSize: CHUNK_SIZE,
      sha256Checksum,
      isExecutableRisk: isRisky,
    };

    const newTransfer: ActiveTransfer = {
      metadata,
      status: 'offering',
      bytesTransferred: 0,
      currentChunkIndex: 0,
      speedBytesPerSec: 0,
      averageSpeedBytesPerSec: 0,
      etaSeconds: 0,
      progressPercent: 0,
      file,
    };

    updateTransferState(newTransfer);

    targetDeviceIds.forEach((targetId) => {
      signalingClient.send({
        protocolVersion: 1,
        type: 'TRANSFER_OFFER',
        targetDeviceId: targetId,
        payload: { metadata },
      });
    });
  };

  const autoAcceptTransferOffer = (metadata: TransferMetadata) => {
    const newTransfer: ActiveTransfer = {
      metadata,
      status: 'transferring',
      bytesTransferred: 0,
      currentChunkIndex: 0,
      speedBytesPerSec: 0,
      averageSpeedBytesPerSec: 0,
      etaSeconds: 0,
      progressPercent: 0,
      receivedChunks: new Array(metadata.totalChunks),
      startTime: Date.now(),
    };

    updateTransferState(newTransfer);

    signalingClient.send({
      protocolVersion: 1,
      type: 'TRANSFER_ACCEPT',
      targetDeviceId: metadata.senderDeviceId,
      payload: { transferId: metadata.transferId },
    });
  };

  const startSendingTransfer = (transferId: string, startChunkIndex: number = 0) => {
    const transfer = activeTransfersMap.current.get(transferId);
    if (!transfer || !transfer.file) return;

    transfer.status = 'transferring';
    if (!transfer.startTime) transfer.startTime = Date.now();
    updateTransferState(transfer);

    const targetId = transfer.metadata.targetDeviceIds[0];
    const dataChannel = webrtcService.getDataChannel(targetId);

    if (!dataChannel) {
      transfer.status = 'failed';
      transfer.error = 'WebRTC DataChannel not available for peer';
      updateTransferState(transfer);
      return;
    }

    TransferEngine.sendFileChunks(
      transfer.file,
      dataChannel,
      startChunkIndex,
      (bytesTransferred, chunkIndex) => {
        transfer.bytesTransferred = bytesTransferred;
        transfer.currentChunkIndex = chunkIndex;
        transfer.progressPercent = Math.min(100, Math.round((bytesTransferred / transfer.metadata.fileSize) * 100));

        const now = Date.now();
        const elapsedSec = (now - (transfer.startTime || now)) / 1000;
        const instantSpeed = elapsedSec > 0 ? bytesTransferred / elapsedSec : 0;
        transfer.speedBytesPerSec = TransferEngine.smoothSpeed(transfer.speedBytesPerSec, instantSpeed);
        transfer.averageSpeedBytesPerSec = instantSpeed;

        const remainingBytes = Math.max(0, transfer.metadata.fileSize - bytesTransferred);
        transfer.etaSeconds = transfer.speedBytesPerSec > 0 ? remainingBytes / transfer.speedBytesPerSec : 0;

        updateTransferState(transfer);
      },
      () => {
        transfer.status = 'completed';
        transfer.verified = true;
        updateTransferState(transfer);
        addToast('Transfer Sent', `Finished sending ${transfer.metadata.fileName}`, 'success');
      },
      (err) => {
        transfer.status = 'failed';
        transfer.error = err.message;
        updateTransferState(transfer);
        addToast('Transfer Failed', err.message, 'error');
      },
      () => transfer.status === 'paused' || transfer.status === 'cancelled'
    );
  };

  const handlePauseTransfer = (transferId: string) => {
    const t = activeTransfersMap.current.get(transferId);
    if (t) {
      t.status = 'paused';
      updateTransferState(t);
    }
  };

  const handleResumeTransfer = (transferId: string) => {
    const t = activeTransfersMap.current.get(transferId);
    if (t) {
      t.status = 'transferring';
      updateTransferState(t);
      if (t.file) {
        startSendingTransfer(transferId, t.currentChunkIndex);
      }
    }
  };

  const handleCancelTransfer = (transferId: string) => {
    const t = activeTransfersMap.current.get(transferId);
    if (t) {
      t.status = 'cancelled';
      t.receivedChunks = [];
      updateTransferState(t);

      if (currentDevice && t.metadata.targetDeviceIds) {
        t.metadata.targetDeviceIds.forEach((targetId) => {
          signalingClient.send({
            protocolVersion: 1,
            type: 'TRANSFER_CANCEL',
            targetDeviceId: targetId,
            payload: { transferId: t.metadata.transferId },
          });
        });
      }
    }
  };

  const handlePreviewFile = (transfer: ActiveTransfer) => {
    if (!transfer.receivedChunks) return;
    const blob = new Blob(transfer.receivedChunks, { type: transfer.metadata.fileType });
    setPreviewTransfer(transfer);
    setPreviewBlob(blob);
  };

  const handleDownloadFile = (transfer: ActiveTransfer) => {
    if (!transfer.receivedChunks) return;
    const blob = new Blob(transfer.receivedChunks, { type: transfer.metadata.fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = transfer.metadata.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStageFiles = (files: File[], targetIds: string[]) => {
    setStagingFiles(files);
    setStagingTargets(targetIds);
    setIsStagingOpen(true);
  };

  const handleConfirmStagedTransfer = () => {
    if (stagingFiles.length > 0 && stagingTargets.length > 0) {
      stagingFiles.forEach((file) => handleSendFile(file, stagingTargets));
      setStagingFiles([]);
      setStagingTargets([]);
      setIsStagingOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-border selection:text-ink">
      <Header
        room={room}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenJoinScan={() => setIsScannerOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        pwaInstallable={!!pwaEvent}
        onInstallPwa={() => pwaEvent && pwaEvent.prompt()}
      />

      <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
        {!room ? (
          <LandingView
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenJoin={() => setIsJoinOpen(true)}
          />
        ) : (
          currentDevice && (
            <RoomDashboard
              room={room}
              currentDevice={currentDevice}
              peers={peers}
              transfers={transfers}
              onSendFile={handleSendFile}
              onSendFolder={(files, targetIds) => {
                const list = Array.from(files);
                handleStageFiles(list, targetIds);
              }}
              onStageFiles={handleStageFiles}
              onPauseTransfer={handlePauseTransfer}
              onResumeTransfer={handleResumeTransfer}
              onCancelTransfer={handleCancelTransfer}
              onAcceptTransfer={(id) => {
                const t = activeTransfersMap.current.get(id);
                if (t) autoAcceptTransferOffer(t.metadata);
              }}
              onRejectTransfer={(id) => handleCancelTransfer(id)}
              onPreviewFile={handlePreviewFile}
              onLeaveRoom={() => {
                setRoom(null);
                setPeers([]);
                webrtcService.closePeerConnection('*');
                addToast('Session Ended', 'You left the room', 'info');
              }}
              onNotify={addToast}
            />
          )
        )}
      </main>

      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateRoom}
      />

      <JoinRoomModal
        isOpen={isJoinOpen}
        initialCode={joinInitialCode}
        onClose={() => setIsJoinOpen(false)}
        onJoin={handleJoinRoom}
        onOpenScanner={() => {
          setIsJoinOpen(false);
          setIsScannerOpen(true);
        }}
      />

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(code) => {
          setIsScannerOpen(false);
          setJoinInitialCode(code);
          setIsJoinOpen(true);
        }}
      />

      <DiagnosticsDrawer
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        networkStats={networkStats}
        room={room}
        peers={peers}
        currentDevice={currentDevice}
      />

      <FileSecurityModal
        metadata={securityModalMetadata}
        onReject={() => setSecurityModalMetadata(null)}
        onAccept={() => {
          if (securityModalMetadata) {
            autoAcceptTransferOffer(securityModalMetadata);
            setSecurityModalMetadata(null);
          }
        }}
      />

      <FilePreviewModal
        metadata={previewTransfer ? previewTransfer.metadata : null}
        blob={previewBlob}
        onClose={() => {
          setPreviewTransfer(null);
          setPreviewBlob(null);
        }}
        onDownload={() => previewTransfer && handleDownloadFile(previewTransfer)}
      />

      <PreTransferModal
        isOpen={isStagingOpen}
        files={stagingFiles}
        targetDevice={
          stagingTargets.length === 1
            ? peers.find((p) => p.id === stagingTargets[0]) || null
            : null
        }
        isAllDevices={stagingTargets.length > 1}
        peerCount={stagingTargets.length}
        onConfirm={handleConfirmStagedTransfer}
        onCancel={() => {
          setStagingFiles([]);
          setStagingTargets([]);
          setIsStagingOpen(false);
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        room={room}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenJoin={() => setIsJoinOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onInstallPwa={() => pwaEvent && pwaEvent.prompt()}
        pwaInstallable={!!pwaEvent}
        onLeaveRoom={() => {
          setRoom(null);
          setPeers([]);
          webrtcService.closePeerConnection('*');
          addToast('Session Ended', 'You left the room', 'info');
        }}
      />

      <ErrorRecoveryModal
        error={errorRecovery}
        onClose={() => setErrorRecovery(null)}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={removeToast}
      />
    </div>
  );
}
