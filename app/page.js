'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, getDocs, arrayUnion, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Search, Paperclip, Mic, Smile, User, LoaderCircle, Video, Phone, X, MicOff, VideoOff, PhoneOff, File } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';
import MicRecorder from 'mic-recorder-to-mp3';
import { v4 as uuidv4 } from 'uuid';

const useOnClickOutside = (ref, handler) => { useEffect(() => { const listener = (event) => { if (!ref.current || ref.current.contains(event.target)) { return; } handler(event); }; document.addEventListener("mousedown", listener); document.addEventListener("touchstart", listener); return () => { document.removeEventListener("mousedown", listener); document.removeEventListener("touchstart", listener); }; }, [ref, handler]);};

const servers = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };

const UserListItem = ({ user, isSelected, onSelect, lastMessage }) => {
    return (
        <div onClick={() => onSelect(user)} className={`flex items-center gap-4 p-3 cursor-pointer rounded-lg transition-colors duration-200 ${isSelected ? 'bg-indigo-500/10 dark:bg-indigo-500/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            <img src={user.photoURL} alt={user.displayName} className="h-12 w-12 rounded-full" />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">{user.displayName}</p>
                    {lastMessage?.createdAt && <p className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0 ml-2">{formatDistanceToNow(lastMessage.createdAt.toDate(), { addSuffix: true })}</p>}
                </div>
                {lastMessage && <p className="text-xs truncate pr-2 text-zinc-500 dark:text-zinc-400 mt-1">{lastMessage.text}</p>}
            </div>
        </div>
    );
};

const UserListSidebar = ({ users, currentUser, selectedUser, onSelectUser, lastMessages }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredUsers = useMemo(() => users.filter(user => user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())), [users, searchTerm]);

    return (
        <aside className="w-full md:w-[380px] h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className='flex items-center justify-between'>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Chats</h1>
                    <img src={currentUser?.photoURL} alt="You" className="h-10 w-10 rounded-full" />
                </div>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-indigo-500 focus:ring-indigo-500 rounded-full pl-9 pr-4 py-2 text-sm outline-none transition-colors" />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredUsers.map(user => <UserListItem key={user.uid} user={user} isSelected={selectedUser?.uid === user.uid} onSelect={onSelectUser} lastMessage={lastMessages[user.uid]}/>)}
            </div>
        </aside>
    );
};

const MessageItem = ({ msg, isCurrentUser }) => {
    const renderContent = () => {
        switch (msg.type) {
            case 'image': return <img src={msg.mediaUrl} alt="uploaded content" className="rounded-lg max-w-xs cursor-pointer" onClick={() => window.open(msg.mediaUrl, '_blank')} />;
            case 'audio': return <audio controls src={msg.mediaUrl} className="w-64 h-12" />;
            case 'file': return <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className='flex items-center gap-3 bg-zinc-200/50 dark:bg-zinc-700/50 p-3 rounded-lg hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50'><File className='h-8 w-8 text-indigo-500' /><span className='font-medium text-sm'>{msg.fileName || 'Download File'}</span></a>
            default: return <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap">{msg.text}</div>;
        }
    };
    const messageDate = msg.createdAt?.toDate();
    return (
        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex items-end gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md md:max-w-lg rounded-2xl ${isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100'} ${msg.type === 'text' ? 'p-3' : 'p-1.5'} ${isCurrentUser ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                {renderContent()}
                <p className={`text-xs mt-1.5 opacity-60 text-right ${isCurrentUser ? 'text-indigo-200' : 'text-zinc-500'}`}>{messageDate ? format(messageDate, 'p') : 'sending...'}</p>
            </div>
        </motion.div>
    );
};

const VideoCallModal = ({ callData, pc, localStream, remoteStream, onEndCall, onToggleMute, onToggleVideo, isMuted, isVideoOff }) => {
    if (!callData?.active) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="relative w-full h-full">
                <video ref={el => el && (el.srcObject = remoteStream)} autoPlay playsInline className="w-full h-full object-cover" />
                <video ref={el => el && (el.srcObject = localStream)} autoPlay playsInline muted className="absolute bottom-6 right-6 w-48 h-36 object-cover rounded-lg border-2 border-zinc-600" />
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                    <button onClick={onToggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-white text-black' : 'bg-zinc-700/80 text-white'}`}> {isMuted ? <MicOff /> : <Mic />}</button>
                    <button onClick={onToggleVideo} className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-zinc-700/80 text-white'}`}>{isVideoOff ? <VideoOff /> : <Video />}</button>
                    <button onClick={onEndCall} className="p-4 rounded-full bg-red-500 text-white animate-pulse-deep"><PhoneOff /></button>
                </div>
                {callData.status === 'ringing' && callData.to === auth.currentUser.uid && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white">
                        <p className="text-2xl font-semibold">Incoming Call...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const IncomingCallToast = ({ callData, onAccept, onDecline }) => {
    if (!callData || callData.status !== 'ringing' || callData.to !== auth.currentUser.uid) {
        return null;
    }

    return (
        <div className="fixed top-5 right-5 z-50 bg-zinc-800 text-white p-4 rounded-lg shadow-lg flex items-center gap-4">
            <div>
                <p className="font-bold">Incoming Call</p>
                <p className="text-sm text-zinc-300">from {callData.fromName}</p>
            </div>
            <button onClick={onAccept} className="p-3 bg-green-500 rounded-full hover:bg-green-600"><Phone /></button>
            <button onClick={onDecline} className="p-3 bg-red-500 rounded-full hover:bg-red-600"><PhoneOff /></button>
        </div>
    );
}

const ChatWindow = ({ selectedUser, currentUser, onBack }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recorder, setRecorder] = useState(null);
    const [chatId, setChatId] = useState(null);
    
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [pc, setPc] = useState(null);
    const [callData, setCallData] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isCallee, setIsCallee] = useState(false);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const emojiMenuRef = useRef(null);

    useOnClickOutside(emojiMenuRef, () => setShowEmojiPicker(false));

    useEffect(() => {
        if (currentUser?.uid && selectedUser?.uid) {
            const newChatId = [currentUser.uid, selectedUser.uid].sort().join('_');
            setChatId(newChatId);
        }
    }, [currentUser, selectedUser]);

    useEffect(() => {
        if (!chatId) return;
        const chatDocRef = doc(db, 'chats', chatId);
        const unsubscribe = onSnapshot(chatDocRef, (doc) => {
            if (doc.exists() && doc.data().call) {
                const data = doc.data().call;
                setCallData({ ...data, fromName: selectedUser.displayName });

                if(data.status === 'ringing' && data.to === currentUser.uid) {
                    setIsCallee(true);
                }
            } else {
                if (callData) endCall(true);
            }
        });
        return () => unsubscribe();
    }, [chatId, currentUser?.uid]);

    useEffect(() => {
      if (pc && callData?.answer) {
        pc.setRemoteDescription(new RTCSessionDescription(callData.answer)).catch(e => console.error("Error setting remote description:", e));
      }
    }, [pc, callData?.answer]);

    useEffect(() => {
        if (pc && callData?.calleeCandidates) {
            callData.calleeCandidates.forEach(candidate => {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding received ICE candidate:", e));
            });
        }
    }, [pc, callData?.calleeCandidates]);

    const startCall = async (isVideo) => {
        if (!chatId) return;

        const peerConnection = new RTCPeerConnection(servers);
        setPc(peerConnection);

        const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        setLocalStream(stream);

        const remote = new MediaStream();
        setRemoteStream(remote);

        peerConnection.ontrack = event => {
            event.streams[0].getTracks().forEach(track => remote.addTrack(track));
        };
        
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await updateDoc(doc(db, 'chats', chatId), { "call.callerCandidates": arrayUnion({ ...event.candidate.toJSON() }) });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const callDoc = {
            from: currentUser.uid,
            to: selectedUser.uid,
            offer: { sdp: offer.sdp, type: offer.type },
            status: 'ringing',
            isVideo,
            active: true,
            callerCandidates: [],
            calleeCandidates: []
        };
        await updateDoc(doc(db, 'chats', chatId), { call: callDoc });
    };

    const answerCall = async () => {
        setIsCallee(false);
        if (!callData?.offer) return;
        const peerConnection = new RTCPeerConnection(servers);
        setPc(peerConnection);
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: callData.isVideo, audio: true });
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        setLocalStream(stream);
        
        const remote = new MediaStream();
        setRemoteStream(remote);

        peerConnection.ontrack = event => {
            event.streams[0].getTracks().forEach(track => remote.addTrack(track));
        };

        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await updateDoc(doc(db, 'chats', chatId), { "call.calleeCandidates": arrayUnion({ ...event.candidate.toJSON() }) });
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await updateDoc(doc(db, 'chats', chatId), { "call.answer": { sdp: answer.sdp, type: answer.type }, "call.status": "active" });
        
        if (callData?.callerCandidates) {
            callData.callerCandidates.forEach(candidate => {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding initial ICE candidate:", e));
            });
        }
    };
    
    const declineCall = async () => {
        setIsCallee(false);
        if (chatId) {
            await updateDoc(doc(db, 'chats', chatId), { call: null });
        }
    };

    const endCall = async (isRemote = false) => {
        if (pc) {
            pc.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        setPc(null);
        setLocalStream(null);
        setRemoteStream(null);
        setCallData(null);
        setIsMuted(false);
        setIsVideoOff(false);
        setIsCallee(false);
        
        if (!isRemote && chatId) {
            await updateDoc(doc(db, 'chats', chatId), { call: null });
        }
    };
    
    const toggleMute = () => {
        if(localStream){
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(prev => !prev);
        }
    };

    const toggleVideo = () => {
        if(localStream){
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(prev => !prev);
        }
    };

    useEffect(() => { setRecorder(new MicRecorder({ bitRate: 128 })); }, []);

    useEffect(() => {
        if (!chatId) return;

        const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(messagesQuery, (snap) => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const chatDocRef = doc(db, 'chats', chatId);
        getDoc(chatDocRef).then(docSnap => {
            if (!docSnap.exists()) {
                setDoc(chatDocRef, {
                    members: [currentUser.uid, selectedUser.uid],
                    updatedAt: serverTimestamp()
                });
            }
        });
        
        return () => unsubscribe();
    }, [chatId, currentUser, selectedUser]);
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, [newMessage]);

    const sendDbMessage = async (messageData, lastMessageText) => {
        setIsSending(true);
        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), { ...messageData, senderId: currentUser.uid, createdAt: serverTimestamp() });
            await updateDoc(doc(db, 'chats', chatId), { lastMessage: lastMessageText, updatedAt: serverTimestamp() });
            setNewMessage('');
        } catch (error) { toast.error("Failed to send message."); }
        finally { setIsSending(false); }
    };
    
    const handleSendMessage = async (e) => { e.preventDefault(); const trimmedMessage = newMessage.trim(); if (!trimmedMessage || isSending) return; await sendDbMessage({ type: 'text', text: trimmedMessage }, trimmedMessage); };
    const handleFileUpload = async (file) => { const toastId = toast.loading("Uploading file..."); const isImage = file.type.startsWith('image/'); const isAudio = file.type.startsWith('audio/'); try { const storageRef = ref(storage, `uploads/${chatId}/${uuidv4()}`); await uploadBytes(storageRef, file); const downloadURL = await getDownloadURL(storageRef); const fileType = isImage ? 'image' : isAudio ? 'audio' : 'file'; await sendDbMessage({ type: fileType, mediaUrl: downloadURL, fileName: file.name }, `Sent a ${fileType}`); toast.success("File uploaded!", { id: toastId }); } catch (error) { toast.error("Upload failed.", { id: toastId }); } };
    const handleRecord = () => { if (isRecording) { recorder.stop().getMp3().then(([buffer, blob]) => { const file = new File(buffer, 'voice-message.mp3', { type: 'audio/mpeg', lastModified: Date.now() }); handleFileUpload(file); }).catch(() => toast.error("Failed to record audio.")); setIsRecording(false); } else { recorder.start().then(() => setIsRecording(true)).catch(() => toast.error("Microphone access denied.")); } };

    if (!selectedUser) return (
        <div className="hidden lg:flex flex-col h-full items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-center p-4">
            <User className="h-20 w-20 text-zinc-300 dark:text-zinc-700 mb-4" />
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">Select a user to chat</h2>
            <p className="text-zinc-500 dark:text-zinc-400">Choose a user from the sidebar to start a conversation.</p>
        </div>
    );
    
    return (
        <div className="flex flex-col h-screen bg-zinc-100 dark:bg-zinc-900">
            <VideoCallModal callData={callData} pc={pc} localStream={localStream} remoteStream={remoteStream} onEndCall={endCall} onToggleMute={toggleMute} onToggleVideo={toggleVideo} isMuted={isMuted} isVideoOff={isVideoOff} />
            <IncomingCallToast callData={callData} onAccept={answerCall} onDecline={declineCall} />
            <header className="flex items-center p-4 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm z-10">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 mr-3 lg:hidden"><ArrowLeft className="h-5 w-5 text-zinc-600 dark:text-zinc-300" /></button>
                <div className="flex items-center gap-3">
                    <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="h-10 w-10 rounded-full" />
                    <div>
                        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">{selectedUser.displayName}</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Online</p>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => startCall(true)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><Video className="h-5 w-5 text-zinc-500 dark:text-zinc-400" /></button>
                    <button onClick={() => startCall(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><Phone className="h-5 w-5 text-zinc-500 dark:text-zinc-400" /></button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="space-y-4">{messages.map((msg) => <MessageItem key={msg.id} msg={msg} isCurrentUser={msg.senderId === currentUser.uid} />)}<div ref={messagesEndRef} /></div></main>
            <footer className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
                <form onSubmit={handleSendMessage} className="flex items-start gap-2">
                    <div className="relative w-full flex items-center">
                        <textarea ref={textareaRef} rows={1} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={isRecording ? "Recording..." : "Type your message..."} disabled={isRecording} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} className="w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-indigo-500 focus:ring-0 rounded-2xl px-4 py-3 text-sm outline-none transition-colors resize-none overflow-y-hidden pr-12" />
                        <div ref={emojiMenuRef} className="absolute right-3">
                            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"><Smile className="h-5 w-5 text-zinc-500" /></button>
                            {showEmojiPicker && <div className="absolute bottom-14 right-0 z-10"><EmojiPicker theme='dark' onEmojiClick={(emojiObject) => setNewMessage(prev => prev + emojiObject.emoji)} /></div>}
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current.click()} className="p-3.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0"><Paperclip className="h-5 w-5 text-zinc-500" /></button>
                    <button type="button" onClick={handleRecord} className={`p-3.5 rounded-full transition-colors flex-shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}><Mic className={`h-5 w-5 ${isRecording ? '' : 'text-zinc-500'}`} /></button>
                    <button type="submit" disabled={isSending || !newMessage.trim()} className="grid place-items-center h-12 w-12 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed">{isSending ? <LoaderCircle className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}</button>
                </form>
            </footer>
        </div>
    );
};

export default function ChatPage() {
    const [user, loading] = useAuthState(auth);
    const router = useRouter();
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [lastMessages, setLastMessages] = useState({});

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);
    
    useEffect(() => {
        if (!user) return;
        const usersQuery = query(collection(db, 'users'), where('uid', '!=', user.uid));
        const unsubscribe = onSnapshot(usersQuery, (snap) => {
            setAllUsers(snap.docs.map(d => d.data()));
        });
        return () => unsubscribe();
    }, [user]);

     useEffect(() => {
        if (!user || allUsers.length === 0) return;
        
        const unsubscribers = allUsers.map(otherUser => {
            const chatId = [user.uid, otherUser.uid].sort().join('_');
            const chatQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), where('senderId', '==', otherUser.uid));
            return onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
                if (docSnap.exists()) {
                     setLastMessages(prev => ({ ...prev, [otherUser.uid]: docSnap.data() }));
                }
            });
        });

        return () => unsubscribers.forEach(unsub => unsub());
    }, [allUsers, user]);

    if (loading || !user) {
        return <div className="flex h-screen items-center justify-center bg-zinc-950"><LoaderCircle className="h-12 w-12 animate-spin text-indigo-500" /></div>;
    }
    
    return (
        <>
            <Toaster richColors position="top-right" />
            <div className="flex h-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                <div className={`${selectedUser ? 'hidden lg:flex' : 'flex'} w-full lg:w-auto`}>
                    <UserListSidebar users={allUsers} currentUser={user} selectedUser={selectedUser} onSelectUser={setSelectedUser} lastMessages={lastMessages} />
                </div>
                <main className={`flex-1 ${selectedUser ? 'block' : 'hidden'} lg:block`}>
                    <ChatWindow selectedUser={selectedUser} currentUser={user} onBack={() => setSelectedUser(null)} />
                </main>
            </div>
        </>
    );
}