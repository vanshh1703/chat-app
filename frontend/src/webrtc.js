/**
 * WebRTC Core Logic
 * Handles media stream and peer connection
 */

export const ICE_SERVERS = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

export const MEDIA_CONSTRAINTS = {
    video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
    },
    audio: true
};

export const createPeerConnection = (onIceCandidate, onTrack) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            onIceCandidate(event.candidate);
        }
    };

    pc.ontrack = (event) => {
        if (onTrack) {
            onTrack(event.streams[0]);
        }
    };

    return pc;
};

export const getMediaStream = async (type = 'video', facingMode = 'user') => {
    try {
        const constraints = type === 'video' ? {
            ...MEDIA_CONSTRAINTS,
            video: {
                ...MEDIA_CONSTRAINTS.video,
                facingMode: facingMode
            }
        } : { video: false, audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        throw error;
    }
};

export const createOffer = async (pc) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
};

export const createAnswer = async (pc, offer) => {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
};

export const handleAnswer = async (pc, answer) => {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
};

export const addIceCandidate = async (pc, candidate) => {
    try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error("Error adding ice candidate", e);
    }
};
