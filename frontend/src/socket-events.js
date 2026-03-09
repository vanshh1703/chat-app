/**
 * Socket Signaling Events
 * Handles communication with the signaling server
 */

export const emitCallUser = (socket, { to, from, name, avatar, type }) => {
    socket.emit('call-user', { to, from, name, avatar, type });
};

export const emitAcceptCall = (socket, { to, callId }) => {
    socket.emit('accept-call', { to, callId });
};

export const emitRejectCall = (socket, { to, callId }) => {
    socket.emit('reject-call', { to, callId });
};

export const emitOffer = (socket, { to, offer }) => {
    socket.emit('send-offer', { to, offer });
};

export const emitAnswer = (socket, { to, answer }) => {
    socket.emit('send-answer', { to, answer });
};

export const emitIceCandidate = (socket, { to, candidate }) => {
    socket.emit('ice-candidate', { to, candidate });
};

export const emitEndCall = (socket, { to, callId }) => {
    socket.emit('end-call', { to, callId });
};
