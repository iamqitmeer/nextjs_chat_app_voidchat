"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
  arrayUnion,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuthState } from "react-firebase-hooks/auth";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Send,
  Search,
  Paperclip,
  Mic,
  Smile,
  User,
  LoaderCircle,
  Video,
  Phone,
  X,
  MicOff,
  VideoOff,
  PhoneOff,
  File,
  MessageCircle,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import EmojiPicker from "emoji-picker-react";
import MicRecorder from "mic-recorder-to-mp3";
import { v4 as uuidv4 } from "uuid";

const useOnClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
};

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

const UserListItem = ({ user, isSelected, onSelect, lastMessage }) => {
  return (
    <motion.div
      layout
      onClick={() => onSelect(user)}
      className={`flex items-center gap-4 p-3 cursor-pointer rounded-2xl transition-all duration-300 ${
        isSelected ? "bg-brand-muted" : "hover:bg-brand-surface"
      }`}
    >
      <div className="relative">
        <img
          src={user.photoURL}
          alt={user.displayName}
          className="h-12 w-12 rounded-full"
        />
        <span
          className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full bg-green-400 border-2 border-brand-surface ring-1 ring-green-400`}
        ></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-sm truncate text-zinc-100">
            {user.displayName}
          </p>
          {lastMessage?.createdAt && (
            <p className="text-xs text-zinc-500 flex-shrink-0 ml-2">
              {formatDistanceToNowStrict(lastMessage.createdAt.toDate())}
            </p>
          )}
        </div>
        {lastMessage && (
          <p className="text-xs truncate pr-2 text-zinc-400 mt-1">
            {lastMessage.text}
          </p>
        )}
      </div>
    </motion.div>
  );
};

const UserListSidebar = ({
  users,
  currentUser,
  selectedUser,
  onSelectUser,
  lastMessages,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [users, searchTerm]
  );

  return (
    <aside className="w-full md:w-[380px] h-screen bg-brand-surface border-r border-brand-subtle flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-brand-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-brand-accent" />
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-400">
              VoidChat
            </h1>
          </div>
          <img
            src={currentUser?.photoURL}
            alt="You"
            className="h-10 w-10 rounded-full border-2 border-brand-subtle"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Search connections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-brand-muted border border-transparent focus:border-brand-accent focus:ring-brand-accent rounded-full pl-10 pr-4 py-2.5 text-sm text-zinc-200 outline-none transition-colors"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredUsers.map((user) => (
          <UserListItem
            key={user.uid}
            user={user}
            isSelected={selectedUser?.uid === user.uid}
            onSelect={onSelectUser}
            lastMessage={lastMessages[user.uid]}
          />
        ))}
      </div>
    </aside>
  );
};

const MessageItem = ({ msg, isCurrentUser }) => {
  const renderContent = () => {
    switch (msg.type) {
      case "image":
        return (
          <img
            src={msg.mediaUrl}
            alt="uploaded content"
            className="rounded-xl max-w-xs cursor-pointer"
            onClick={() => window.open(msg.mediaUrl, "_blank")}
          />
        );
      case "audio":
        return <audio controls src={msg.mediaUrl} className="w-64 h-11" />;
      case "file":
        return (
          <a
            href={msg.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-brand-accent/10 p-3 rounded-lg hover:bg-brand-accent/20"
          >
            <File className="h-8 w-8 text-brand-accent" />
            <span className="font-medium text-sm text-zinc-200">
              {msg.fileName || "Download File"}
            </span>
          </a>
        );
      default:
        return (
          <div className="prose prose-sm prose-p:my-0 text-white max-w-none break-words whitespace-pre-wrap">
            {msg.text}
          </div>
        );
    }
  };
  const messageDate = msg.createdAt?.toDate();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex items-end gap-2 ${
        isCurrentUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-md md:max-w-lg rounded-2xl ${
          isCurrentUser
            ? "bg-brand-accent text-white"
            : "bg-brand-muted text-zinc-200"
        } ${msg.type === "text" ? "p-3" : "p-1.5"} ${
          isCurrentUser ? "rounded-br-lg" : "rounded-bl-lg"
        }`}
      >
        {renderContent()}
        <p className={`text-xs mt-1.5 opacity-60 text-right`}>
          {messageDate ? format(messageDate, "p") : "sending..."}
        </p>
      </div>
    </motion.div>
  );
};

const VideoCallModal = ({
  callData,
  pc,
  localStream,
  remoteStream,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  isMuted,
  isVideoOff,
}) => {
  if (!callData?.active) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="relative w-full h-full">
        <video
          ref={(el) => el && (el.srcObject = remoteStream)}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <video
          ref={(el) => el && (el.srcObject = localStream)}
          autoPlay
          playsInline
          muted
          className="absolute bottom-28 right-8 w-48 h-36 object-cover rounded-2xl border-2 border-white/20 shadow-2xl"
        />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-sm p-3 rounded-full border border-white/10">
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted ? "bg-white text-black" : "bg-white/20 text-white"
            }`}
          >
            {" "}
            {isMuted ? <MicOff /> : <Mic />}
          </button>
          <button
            onClick={onToggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoOff ? "bg-white text-black" : "bg-white/20 text-white"
            }`}
          >
            {isVideoOff ? <VideoOff /> : <Video />}
          </button>
          <button
            onClick={onEndCall}
            className="p-4 rounded-full bg-red-500 text-white animate-glow shadow-lg shadow-red-500/50"
          >
            <PhoneOff />
          </button>
        </div>
      </div>
    </div>
  );
};

const IncomingCallToast = ({ callData, onAccept, onDecline }) => {
  if (
    !callData ||
    callData.status !== "ringing" ||
    callData.to !== auth.currentUser.uid
  )
    return null;
  return (
    <div className="fixed top-5 right-5 z-50 bg-brand-surface/80 backdrop-blur-xl border border-brand-subtle shadow-2xl shadow-brand-accent/20 p-4 rounded-2xl flex items-center gap-4 animate-fade-in-up">
      <div className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center animate-glow">
        <Phone className="text-white" />
      </div>
      <div>
        <p className="font-bold text-zinc-100">Incoming Call</p>
        <p className="text-sm text-zinc-400">from {callData.fromName}</p>
      </div>
      <button
        onClick={onAccept}
        className="p-3 bg-green-500/20 text-green-400 rounded-full hover:bg-green-500/30"
      >
        <Phone />
      </button>
      <button
        onClick={onDecline}
        className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30"
      >
        <PhoneOff />
      </button>
    </div>
  );
};

const ChatWindow = ({ selectedUser, currentUser, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
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
    if (currentUser?.uid && selectedUser?.uid)
      setChatId([currentUser.uid, selectedUser.uid].sort().join("_"));
  }, [currentUser, selectedUser]);
  useEffect(() => {
    if (!chatId) return;
    const chatDocRef = doc(db, "chats", chatId);
    const unsubscribe = onSnapshot(chatDocRef, (doc) => {
      if (doc.exists() && doc.data().call) {
        const data = doc.data().call;
        setCallData({ ...data, fromName: selectedUser.displayName });
        if (data.status === "ringing" && data.to === currentUser.uid)
          setIsCallee(true);
      } else {
        if (callData) endCall(true);
      }
    });
    return () => unsubscribe();
  }, [chatId, currentUser?.uid]);
  useEffect(() => {
    if (pc && callData?.answer) {
      pc.setRemoteDescription(new RTCSessionDescription(callData.answer)).catch(
        console.error
      );
    }
  }, [pc, callData?.answer]);
  useEffect(() => {
    if (pc && callData?.calleeCandidates) {
      callData.calleeCandidates.forEach((candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      });
    }
  }, [pc, callData?.calleeCandidates]);

  const startCall = async (isVideo) => {
    if (!chatId) return;
    const peerConnection = new RTCPeerConnection(servers);
    setPc(peerConnection);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: isVideo,
      audio: true,
    });
    stream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, stream));
    setLocalStream(stream);
    const remote = new MediaStream();
    setRemoteStream(remote);
    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remote.addTrack(track));
    };
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate)
        await updateDoc(doc(db, "chats", chatId), {
          "call.callerCandidates": arrayUnion({ ...event.candidate.toJSON() }),
        });
    };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const callDoc = {
      from: currentUser.uid,
      to: selectedUser.uid,
      offer: { sdp: offer.sdp, type: offer.type },
      status: "ringing",
      isVideo,
      active: true,
      callerCandidates: [],
      calleeCandidates: [],
    };
    await updateDoc(doc(db, "chats", chatId), { call: callDoc });
  };
  const answerCall = async () => {
    setIsCallee(false);
    if (!callData?.offer) return;
    const peerConnection = new RTCPeerConnection(servers);
    setPc(peerConnection);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: callData.isVideo,
      audio: true,
    });
    stream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, stream));
    setLocalStream(stream);
    const remote = new MediaStream();
    setRemoteStream(remote);
    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remote.addTrack(track));
    };
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate)
        await updateDoc(doc(db, "chats", chatId), {
          "call.calleeCandidates": arrayUnion({ ...event.candidate.toJSON() }),
        });
    };
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(callData.offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await updateDoc(doc(db, "chats", chatId), {
      "call.answer": { sdp: answer.sdp, type: answer.type },
      "call.status": "active",
    });
    if (callData?.callerCandidates) {
      callData.callerCandidates.forEach((candidate) => {
        peerConnection
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch(console.error);
      });
    }
  };
  const declineCall = async () => {
    setIsCallee(false);
    if (chatId) await updateDoc(doc(db, "chats", chatId), { call: null });
  };
  const endCall = async (isRemote = false) => {
    if (pc) pc.close();
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    setPc(null);
    setLocalStream(null);
    setRemoteStream(null);
    setCallData(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsCallee(false);
    if (!isRemote && chatId)
      await updateDoc(doc(db, "chats", chatId), { call: null });
  };
  const toggleMute = () => {
    if (localStream) {
      localStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setIsMuted((p) => !p);
    }
  };
  const toggleVideo = () => {
    if (localStream) {
      localStream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setIsVideoOff((p) => !p);
    }
  };

  useEffect(() => {
    setRecorder(new MicRecorder({ bitRate: 128 }));
  }, []);
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    getDoc(doc(db, "chats", chatId)).then((docSnap) => {
      if (!docSnap.exists())
        setDoc(doc(db, "chats", chatId), {
          members: [currentUser.uid, selectedUser.uid],
          updatedAt: serverTimestamp(),
        });
    });
    return () => unsubscribe();
  }, [chatId, currentUser, selectedUser]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newMessage]);

  const sendDbMessage = async (messageData, lastMessageText) => {
    setIsSending(true);
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        ...messageData,
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: lastMessageText,
        updatedAt: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      toast.error("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || isSending) return;
    await sendDbMessage({ type: "text", text: trimmedMessage }, trimmedMessage);
  };
  const handleFileUpload = async (file) => {
    const toastId = toast.loading("Uploading file...");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    try {
      const storageRef = ref(storage, `uploads/${chatId}/${uuidv4()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      const fileType = isImage ? "image" : isAudio ? "audio" : "file";
      await sendDbMessage(
        { type: fileType, mediaUrl: downloadURL, fileName: file.name },
        `Sent a ${fileType}`
      );
      toast.success("File uploaded!", { id: toastId });
    } catch (error) {
      toast.error("Upload failed.", { id: toastId });
    }
  };
  const handleRecord = () => {
    if (isRecording) {
      recorder
        .stop()
        .getMp3()
        .then(([buffer, blob]) => {
          const file = new File(buffer, "voice-message.mp3", {
            type: "audio/mpeg",
            lastModified: Date.now(),
          });
          handleFileUpload(file);
        })
        .catch(() => toast.error("Failed to record audio."));
      setIsRecording(false);
    } else {
      recorder
        .start()
        .then(() => setIsRecording(true))
        .catch(() => toast.error("Microphone access denied."));
    }
  };

  if (!selectedUser)
    return (
      <div className="hidden lg:flex flex-col h-full items-center justify-center bg-brand-bg text-center p-4">
        {" "}
        <MessageCircle className="h-20 w-20 text-brand-subtle mb-4" />{" "}
        <h2 className="text-xl font-bold text-zinc-200">
          Select a Conversation
        </h2>{" "}
        <p className="text-zinc-500 max-w-xs">
          Choose a connection from the sidebar to view your message history.
        </p>{" "}
      </div>
    );

  return (
    <div className="flex flex-col h-screen bg-brand-bg">
      <VideoCallModal
        callData={callData}
        pc={pc}
        localStream={localStream}
        remoteStream={remoteStream}
        onEndCall={endCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
      />
      <IncomingCallToast
        callData={callData}
        onAccept={answerCall}
        onDecline={declineCall}
      />
      <header className="flex items-center p-4 bg-brand-surface/80 backdrop-blur-lg border-b border-brand-subtle z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-brand-muted mr-3 lg:hidden"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-400" />
        </button>
        <div className="flex items-center gap-3">
          <img
            src={selectedUser.photoURL}
            alt={selectedUser.displayName}
            className="h-10 w-10 rounded-full"
          />
          <div>
            <h2 className="font-bold text-zinc-100">
              {selectedUser.displayName}
            </h2>
            <p className="text-xs text-zinc-500">Online</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => startCall(true)}
            className="p-2.5 rounded-full hover:bg-brand-muted"
          >
            <Video className="h-5 w-5 text-zinc-400" />
          </button>
          <button
            onClick={() => startCall(false)}
            className="p-2.5 rounded-full hover:bg-brand-muted"
          >
            <Phone className="h-5 w-5 text-zinc-400" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              isCurrentUser={msg.senderId === currentUser.uid}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <footer className="p-4 bg-transparent border-t border-brand-subtle">
        <form onSubmit={handleSendMessage} className="flex items-start gap-3">
          <div className="relative w-full flex items-center bg-brand-muted rounded-full border border-brand-subtle focus-within:border-brand-accent transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isRecording ? "Recording..." : "Type a message..."}
              disabled={isRecording}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              className="w-full bg-transparent border-transparent focus:ring-0 rounded-full pl-5 pr-24 py-3 text-sm text-zinc-200 resize-none overflow-y-hidden"
            />
            <div className="absolute right-4 flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) =>
                  e.target.files[0] && handleFileUpload(e.target.files[0])
                }
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="p-2 rounded-full hover:bg-brand-subtle"
              >
                <Paperclip className="h-5 w-5 text-zinc-400" />
              </button>
              <div ref={emojiMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 rounded-full hover:bg-brand-subtle"
                >
                  <Smile className="h-5 w-5 text-zinc-400" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-14 right-0 z-10">
                    <EmojiPicker
                      theme="dark"
                      onEmojiClick={(emojiObject) =>
                        setNewMessage((prev) => prev + emojiObject.emoji)
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRecord}
            className={`p-3.5 rounded-full transition-colors flex-shrink-0 ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-brand-muted hover:bg-brand-subtle"
            }`}
          >
            <Mic className={`h-5 w-5 ${isRecording ? "" : "text-zinc-400"}`} />
          </button>
          <button
            type="submit"
            disabled={isSending || !newMessage.trim()}
            className="grid place-items-center h-12 w-12 flex-shrink-0 bg-brand-accent text-white rounded-full transition-all duration-300 disabled:bg-brand-subtle disabled:cursor-not-allowed hover:scale-110 active:scale-100"
          >
            {isSending ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
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
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), where("uid", "!=", user.uid));
    const unsubscribe = onSnapshot(q, (snap) =>
      setAllUsers(snap.docs.map((d) => d.data()))
    );
    return () => unsubscribe();
  }, [user]);
  useEffect(() => {
    if (!user || allUsers.length === 0) return;
    const unsubscribers = allUsers.map((otherUser) => {
      const chatId = [user.uid, otherUser.uid].sort().join("_");
      return onSnapshot(doc(db, "chats", chatId), (docSnap) => {
        if (docSnap.exists())
          setLastMessages((prev) => ({
            ...prev,
            [otherUser.uid]: docSnap.data(),
          }));
      });
    });
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [allUsers, user]);

  if (loading || !user)
    return (
      <div className="flex h-screen items-center justify-center bg-brand-bg">
        <LoaderCircle className="h-12 w-12 animate-spin text-brand-accent" />
      </div>
    );

  return (
    <>
      <Toaster theme="dark" richColors position="top-right" />
      <div className="flex h-screen overflow-hidden bg-brand-bg">
        <div
          className={`${
            selectedUser ? "hidden lg:flex" : "flex"
          } w-full lg:w-auto`}
        >
          <UserListSidebar
            users={allUsers}
            currentUser={user}
            selectedUser={selectedUser}
            onSelectUser={setSelectedUser}
            lastMessages={lastMessages}
          />
        </div>
        <main
          className={`flex-1 ${selectedUser ? "block" : "hidden"} lg:block`}
        >
          <ChatWindow
            selectedUser={selectedUser}
            currentUser={user}
            onBack={() => setSelectedUser(null)}
          />
        </main>
      </div>
    </>
  );
}
