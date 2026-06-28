/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentApi } from '../services/appointmentApi';
import { videoApi } from '../services/videoApi';

const VideoContext = createContext(null);

export function VideoProvider({ children }) {
  const navigate = useNavigate();
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [meetingId, setMeetingId] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Excellent');
  const [chatMessages, setChatMessages] = useState([]);
  const [duration, setDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [localStream, setLocalStream] = useState(null);

  const timerRef = useRef(null);
  const activeStreamRef = useRef(null);

  // Clean up streams when component unmounts
  useEffect(() => {
    return () => {
      cleanupStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function cleanupStream() {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setLocalStream(null);
  }

  const initiateBooking = (doctor) => {
    setCurrentDoctor(doctor);
  };

  const confirmBooking = async (date, time, reason, consultMode = 'video', fee = '') => {
    if (!currentDoctor) return null;
    try {
      const res = await appointmentApi.bookAppointment({
        doctorId: currentDoctor.id,
        date,
        time,
        reason,
        consultMode,
        fee,
      });
      
      const details = await appointmentApi.getAppointment(res.appointmentId);
      setActiveAppointment(details);
      return res.appointmentId;
    } catch (err) {
      console.error('Booking failed', err);
      throw err;
    }
  };

  const startCall = async (appointmentId) => {
    setIsCallActive(true);
    setDuration(0);
    setChatMessages([
      {
        id: 'msg_welcome',
        sender: 'doctor',
        text: `Hello! I am reading your symptoms profile. I will guide you through our consultation today. How are you feeling?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);

    try {
      // 1. Fetch meeting info
      const room = await videoApi.createRoom(appointmentId);
      setMeetingId(room.meetingId);

      // 2. Request webcam
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setLocalStream(stream);
          activeStreamRef.current = stream;
        } catch (e) {
          console.warn('Webcam permission denied or unavailable, running with silhouette fallback.', e);
        }
      }

      // 3. Start Timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // 4. Simulate sporadic connection quality changes for realism
      const connInterval = setInterval(() => {
        const statuses = ['Excellent', 'Good', 'Excellent', 'Fair', 'Excellent'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        setConnectionStatus(randomStatus);
      }, 15000);

      return () => clearInterval(connInterval);

    } catch (err) {
      console.error('Call initialization failed', err);
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    cleanupStream();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Navigate to consultation summary
    if (activeAppointment) {
      navigate(`/consultation/${activeAppointment.appointmentId}`);
    } else {
      navigate('/consult');
    }
  };

  const toggleMic = () => {
    setIsMicOn((prev) => {
      const next = !prev;
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = next;
        });
      }
      return next;
    });
  };

  const toggleCam = () => {
    setIsCamOn((prev) => {
      const next = !prev;
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.enabled = next;
        });
      }
      return next;
    });
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const sendChatMessage = (text) => {
    if (!text.trim()) return;

    const newMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      sender: 'patient',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMessage]);

    // Simulate doctor typing and reply
    setTimeout(() => {
      const doctorReplies = [
        "I understand. Let's make sure we address this fully. Please describe if you have any other symptoms.",
        "That is helpful context. Based on this, I'd suggest avoiding heavy workouts for a couple of days and staying hydrated.",
        "I am writing a prescription for you right now to alleviate this discomfort. It should show up as soon as we finish our call.",
        "Let me add this to your care notes. I recommend booking a quick follow-up next week so we can review your recovery progress.",
      ];
      
      const replyText = doctorReplies[Math.floor(Math.random() * doctorReplies.length)];
      
      const doctorReply = {
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        sender: 'doctor',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      setChatMessages((prev) => [...prev, doctorReply]);
    }, 2000);
  };

  return (
    <VideoContext.Provider
      value={{
        currentDoctor,
        activeAppointment,
        meetingId,
        isMicOn,
        isCamOn,
        isSpeakerOn,
        isFullscreen,
        connectionStatus,
        chatMessages,
        duration,
        isCallActive,
        localStream,
        initiateBooking,
        confirmBooking,
        startCall,
        endCall,
        toggleMic,
        toggleCam,
        toggleSpeaker,
        toggleFullscreen,
        sendChatMessage,
        setActiveAppointment,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
}

export function useVideoCallContext() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideoCallContext must be used inside VideoProvider');
  return ctx;
}
