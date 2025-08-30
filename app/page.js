"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import { useRouter } from "next/navigation";
import { db, auth, storage, rtdb } from "@/lib/firebase";
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
  arrayUnion,
} from "firebase/firestore";
import {
  ref as dbRef,
  onValue,
  onDisconnect,
  set,
  serverTimestamp as rtdbServerTimestamp,
} from "firebase/database";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuthState } from "react-firebase-hooks/auth";
import { Toaster, toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Send,
  Search,
  Paperclip,
  Mic,
  Smile,
  LoaderCircle,
  Video,
  Phone,
  MicOff,
  VideoOff,
  PhoneOff,
  File,
  MessageCircle,
  Check,
  CheckCheck,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  formatDistanceToNowStrict,
} from "date-fns";
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

const UserStatus = ({ user }) => {
  if (user.status === "online") {
    return (
      <span className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-brand-surface bg-green-400 ring-1 ring-green-400"></span>
    );
  }
  return (
    <span className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-brand-surface bg-zinc-500"></span>
  );
};

const UserListItem = ({ user, isSelected, onSelect, lastMessage }) => {
  return (
    <motion.div
      layout
      onClick={() => onSelect(user)}
      className={`flex cursor-pointer items-center gap-4 rounded-2xl p-3 transition-all duration-300 ${
        isSelected ? "bg-brand-muted" : "hover:bg-brand-surface"
      }`}
    >
      <div className="relative">
        <img
          src={user.photoURL}
          alt={user.displayName}
          className="h-12 w-12 rounded-full"
        />
        <UserStatus user={user} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {user.displayName}
          </p>
          {lastMessage?.createdAt && (
            <p className="ml-2 flex-shrink-0 text-xs text-zinc-500">
              {formatDistanceToNowStrict(lastMessage.createdAt.toDate())}
            </p>
          )}
        </div>
        {lastMessage && (
          <p className="mt-1 truncate pr-2 text-xs text-zinc-400">
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
    <aside className="flex h-screen w-full flex-shrink-0 flex-col border-r border-brand-subtle bg-brand-surface md:w-[380px]">
      <div className="border-b border-brand-subtle p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-brand-accent" />
            <h1 className="bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
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
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search connections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-full border border-transparent bg-brand-muted py-2.5 pl-10 pr-4 text-sm text-zinc-200 outline-none transition-colors focus:border-brand-accent focus:ring-brand-accent"
          />
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
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

const MessageItem = ({ msg, isCurrentUser, chatId, currentUser }) => {
  const messageRef = useRef(null);
  const messageDate = msg.createdAt?.toDate();
  const isSeen = msg.readBy?.includes(
    isCurrentUser ? msg.receiverId : currentUser.uid
  );

  useEffect(() => {
    if (
      !isCurrentUser &&
      messageRef.current &&
      !msg.readBy?.includes(currentUser.uid)
    ) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            const msgDocRef = doc(db, "chats", chatId, "messages", msg.id);
            updateDoc(msgDocRef, { readBy: arrayUnion(currentUser.uid) });
            observer.disconnect();
          }
        },
        { threshold: 0.8 }
      );
      observer.observe(messageRef.current);
      return () => observer.disconnect();
    }
  }, [isCurrentUser, msg.readBy, currentUser.uid, chatId, msg.id]);

  const renderContent = () => {
    switch (msg.type) {
      case "image":
        return (
          <img
            src={msg.mediaUrl}
            alt="uploaded content"
            className="max-w-xs cursor-pointer rounded-xl"
            onClick={() => window.open(msg.mediaUrl, "_blank")}
          />
        );
      case "audio":
        return <audio controls src={msg.mediaUrl} className="h-11 w-64" />;
      case "file":
        return (
          <a
            href={msg.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg bg-brand-accent/10 p-3 hover:bg-brand-accent/20"
          >
            <File className="h-8 w-8 text-brand-accent" />
            <span className="text-sm font-medium text-zinc-200">
              {msg.fileName || "Download File"}
            </span>
          </a>
        );
      default:
        return (
          <div className="prose prose-sm prose-p:my-0 max-w-none break-words whitespace-pre-wrap text-white">
            {msg.text}
          </div>
        );
    }
  };

  const MessageStatus = () => {
    if (!isCurrentUser) return null;
    if (isSeen) return <CheckCheck className="h-4 w-4 text-blue-400" />;
    if (msg.createdAt) return <Check className="h-4 w-4 opacity-60" />;
    return <LoaderCircle className="h-4 w-4 animate-spin opacity-60" />;
  };

  return (
    <motion.div
      ref={messageRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex items-end gap-2 ${
        isCurrentUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-md rounded-2xl md:max-w-lg ${
          isCurrentUser
            ? "bg-brand-accent text-white"
            : "bg-brand-muted text-zinc-200"
        } ${msg.type === "text" ? "p-3" : "p-1.5"} ${
          isCurrentUser ? "rounded-br-lg" : "rounded-bl-lg"
        }`}
      >
        {renderContent()}
        <div
          className={`mt-1.5 flex items-center justify-end gap-1.5 text-xs opacity-60`}
        >
          <span>{messageDate ? format(messageDate, "p") : "sending..."}</span>
          <MessageStatus />
        </div>
      </div>
    </motion.div>
  );
};

const VideoCallModal = ({
  callData,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative h-full w-full">
        <video
          ref={(el) => el && (el.srcObject = remoteStream)}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        <video
          ref={(el) => el && (el.srcObject = localStream)}
          autoPlay
          playsInline
          muted
          className="absolute bottom-28 right-8 h-36 w-48 rounded-2xl border-2 border-white/20 object-cover shadow-2xl"
        />
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-black/40 p-3 backdrop-blur-sm">
          <button
            onClick={onToggleMute}
            className={`rounded-full p-4 transition-colors ${
              isMuted ? "bg-white text-black" : "bg-white/20 text-white"
            }`}
          >
            {isMuted ? <MicOff /> : <Mic />}
          </button>
          <button
            onClick={onToggleVideo}
            className={`rounded-full p-4 transition-colors ${
              isVideoOff ? "bg-white text-black" : "bg-white/20 text-white"
            }`}
          >
            {isVideoOff ? <VideoOff /> : <Video />}
          </button>
          <button
            onClick={onEndCall}
            className="animate-glow rounded-full bg-red-500 p-4 text-white shadow-lg shadow-red-500/50"
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
    auth.currentUser === null ||
    callData.to !== auth.currentUser.uid
  )
    return null;
  return (
    <div className="fixed top-5 right-5 z-50 flex animate-fade-in-up items-center gap-4 rounded-2xl border border-brand-subtle bg-brand-surface/80 p-4 shadow-2xl shadow-brand-accent/20 backdrop-blur-xl">
      <div className="animate-glow flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent">
        <Phone className="text-white" />
      </div>
      <div>
        <p className="font-bold text-zinc-100">Incoming Call</p>
        <p className="text-sm text-zinc-400">from {callData.fromName}</p>
      </div>
      <button
        onClick={onAccept}
        className="rounded-full bg-green-500/20 p-3 text-green-400 hover:bg-green-500/30"
      >
        <Phone />
      </button>
      <button
        onClick={onDecline}
        className="rounded-full bg-red-500/20 p-3 text-red-400 hover:bg-red-500/30"
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
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiMenuRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useOnClickOutside(emojiMenuRef, () => setShowEmojiPicker(false));

  const updateTypingStatus = useCallback(
    async (typing) => {
      if (!chatId) return;
      const chatDocRef = doc(db, "chats", chatId);
      await setDoc(
        chatDocRef,
        { typing: typing ? currentUser.uid : null },
        { merge: true }
      );
    },
    [chatId, currentUser.uid]
  );

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!typingTimeoutRef.current) {
      updateTypingStatus(true);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    if (currentUser?.uid && selectedUser?.uid) {
      setChatId([currentUser.uid, selectedUser.uid].sort().join("_"));
    } else {
      setChatId(null);
    }
  }, [currentUser, selectedUser]);

  const endCall = useCallback(
    async (isRemote = false) => {
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
    },
    [pc, localStream, chatId]
  );

  useEffect(() => {
    if (!chatId || !selectedUser) return;
    const chatDocRef = doc(db, "chats", chatId);
    const unsubscribe = onSnapshot(chatDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsTyping(data.typing && data.typing !== currentUser.uid);
        if (data.call) {
          setCallData({ ...data.call, fromName: selectedUser.displayName });
          if (
            data.call.status === "ringing" &&
            data.call.to === currentUser.uid
          )
            setIsCallee(true);
        } else {
          if (callData) endCall(true);
        }
      }
    });
    return () => unsubscribe();
  }, [chatId, currentUser?.uid, selectedUser, callData, endCall]);

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
        await setDoc(
          doc(db, "chats", chatId),
          { call: { callerCandidates: arrayUnion({ ...event.candidate.toJSON() }) } },
          { merge: true }
        );
    };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const callDoc = {
      from: currentUser.uid,
      fromName: currentUser.displayName,
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
        await setDoc(
          doc(db, "chats", chatId),
          { call: { calleeCandidates: arrayUnion({ ...event.candidate.toJSON() }) } },
          { merge: true }
        );
    };
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(callData.offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await setDoc(
      doc(db, "chats", chatId),
      {
        call: {
          answer: { sdp: answer.sdp, type: answer.type },
          status: "active",
        },
      },
      { merge: true }
    );
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

  useLayoutEffect(() => {
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
        receiverId: selectedUser.uid,
        createdAt: serverTimestamp(),
        readBy: [currentUser.uid],
      });
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: lastMessageText,
        updatedAt: serverTimestamp(),
      });
      setNewMessage("");
      updateTypingStatus(false);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
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
      <div className="hidden h-full flex-col items-center justify-center bg-brand-bg p-4 text-center lg:flex">
        <MessageCircle className="mb-4 h-20 w-20 text-brand-subtle" />
        <h2 className="text-xl font-bold text-zinc-200">
          Select a Conversation
        </h2>
        <p className="max-w-xs text-zinc-500">
          Choose a connection from the sidebar to view your message history.
        </p>
      </div>
    );

  const userStatusText = () => {
    if (selectedUser.status === "online") return "Online";
    if (selectedUser.lastSeen) {
      return `Last seen ${formatDistanceToNow(
        selectedUser.lastSeen.toDate()
      )} ago`;
    }
    return "Offline";
  };

  return (
    <div className="flex h-screen flex-col bg-brand-bg">
      <VideoCallModal
        callData={callData}
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
      <header className="z-10 flex items-center border-b border-brand-subtle bg-brand-surface/80 p-4 backdrop-blur-lg">
        <button
          onClick={onBack}
          className="mr-3 rounded-full p-2 hover:bg-brand-muted lg:hidden"
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
            <p className="text-xs text-zinc-500">
              {isTyping ? "typing..." : userStatusText()}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => startCall(true)}
            className="rounded-full p-2.5 hover:bg-brand-muted"
          >
            <Video className="h-5 w-5 text-zinc-400" />
          </button>
          <button
            onClick={() => startCall(false)}
            className="rounded-full p-2.5 hover:bg-brand-muted"
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
              chatId={chatId}
              currentUser={currentUser}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <footer className="border-t border-brand-subtle bg-transparent p-4">
        <form onSubmit={handleSendMessage} className="flex items-start gap-3">
          <div className="relative flex w-full items-center rounded-full border border-brand-subtle bg-brand-muted transition-colors focus-within:border-brand-accent">
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={handleTyping}
              placeholder={isRecording ? "Recording..." : "Type a message..."}
              disabled={isRecording}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              className="w-full resize-none overflow-y-hidden rounded-full border-transparent bg-transparent py-3 pl-5 pr-24 text-sm text-zinc-200 focus:ring-0"
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
                className="rounded-full p-2 hover:bg-brand-subtle"
              >
                <Paperclip className="h-5 w-5 text-zinc-400" />
              </button>
              <div ref={emojiMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="rounded-full p-2 hover:bg-brand-subtle"
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
            className={`flex-shrink-0 rounded-full p-3.5 transition-colors ${
              isRecording
                ? "animate-pulse bg-red-500 text-white"
                : "bg-brand-muted hover:bg-brand-subtle"
            }`}
          >
            <Mic className={`h-5 w-5 ${isRecording ? "" : "text-zinc-400"}`} />
          </button>
          <button
            type="submit"
            disabled={isSending || !newMessage.trim()}
            className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-brand-accent text-white transition-all duration-300 hover:scale-110 active:scale-100 disabled:cursor-not-allowed disabled:bg-brand-subtle"
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
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      setDoc(
        userRef,
        {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        },
        { merge: true }
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const userStatusDatabaseRef = dbRef(rtdb, "/status/" + user.uid);
    const userStatusFirestoreRef = doc(db, "/users/" + user.uid);

    const isOfflineForFirestore = {
      status: "offline",
      lastSeen: serverTimestamp(),
    };

    const isOnlineForFirestore = {
      status: "online",
      lastSeen: serverTimestamp(),
    };

    const connectedRef = dbRef(rtdb, ".info/connected");
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        set(userStatusDatabaseRef, isOnlineForFirestore.status);
        onDisconnect(userStatusDatabaseRef)
          .set(rtdbServerTimestamp())
          .then(() => {
            setDoc(userStatusFirestoreRef, isOfflineForFirestore, { merge: true });
          });
        setDoc(userStatusFirestoreRef, isOnlineForFirestore, { merge: true });
      } else {
        setDoc(userStatusFirestoreRef, isOfflineForFirestore, { merge: true });
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), where("uid", "!=", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const usersData = snap.docs.map((d) => d.data());
        setAllUsers(usersData);
        if (selectedUser) {
          setSelectedUser(usersData.find((u) => u.uid === selectedUser.uid));
        }
      },
      (error) => {
        console.error("Error fetching users:", error);
        toast.error("Could not fetch users. Check permissions.");
      }
    );
    return () => unsubscribe();
  }, [user, selectedUser]);

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

  const sortedUsers = useMemo(() => {
    return [...allUsers].sort((a, b) => {
      const lastMsgA = lastMessages[a.uid]?.updatedAt;
      const lastMsgB = lastMessages[b.uid]?.updatedAt;
      if (lastMsgA && lastMsgB) {
        return lastMsgB.toMillis() - lastMsgA.toMillis();
      }
      if (lastMsgA) return -1;
      if (lastMsgB) return 1;
      return 0;
    });
  }, [allUsers, lastMessages]);

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
            users={sortedUsers}
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