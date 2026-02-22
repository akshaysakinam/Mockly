'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CerebrasLLM } from '@/lib/cerebras-llm';
import { saveCompletedInterview } from '@/lib/actions/interview.action';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface InterviewRoomProps {
  userName: string;
  userId: string;
  interviewId: string;
  role?: string;
  experienceLevel?: string;
  techStack?: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type InterviewPhase = 'greeting' | 'preliminary' | 'interview' | 'feedback';

interface CandidateInfo {
  name?: string;
  role?: string;
  experienceLevel?: string;
  techStack?: string[];
  questionCount?: number;
}

export default function InterviewRoom({ 
  userName, 
  userId, 
  interviewId,
  role = 'Front-end Developer',
  experienceLevel = 'Mid-level',
  techStack = ['JavaScript', 'React']
}: InterviewRoomProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [feedback, setFeedback] = useState<{
    error?: boolean;
    totalScore: number;
    categoryScores: Array<{name: string; score: number; comment: string}>;
    strengths: string[];
    areasForImprovement: string[];
    finalAssessment: string;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState<string>('');
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [totalQuestions] = useState(5);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interviewPhase, setInterviewPhase] = useState<InterviewPhase>('greeting');
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo>({});
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<'cartesia' | 'browser' | 'unknown'>('unknown');
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const interviewStartTimeRef = useRef<number | null>(null);
  const interviewTargetQuestionsRef = useRef<number>(5);

  const cerebrasLLM = new CerebrasLLM();
  const router = useRouter();

  // Ensure we never generate/speak overlapping questions
  const isGeneratingQuestionRef = useRef<boolean>(false);

  // Sanitize any LLM output to a single clear question
  const sanitizeToSingleQuestion = useCallback((rawText: string): string => {
    if (!rawText) return rawText;
    let text = rawText
      .replace(/^\s*\d+\.|^\s*[-*]\s*/g, '') // remove leading list markers
      .replace(/^(i'll go ahead|let's|get started|here(?:'|’)s|i will|we will|okay[,!]?|alright[,!]?)[:,-]?\s+/i, '') // remove transition
      .trim();

    // Prefer the first sentence that ends with a question mark
    const questionMatch = text.match(/[^?]*\?/);
    if (questionMatch) {
      text = questionMatch[0].trim();
    } else {
      // If no question mark, take the first line/sentence and ensure it ends with '?'
      const firstSentence = (text.split(/\n|\.|!/)[0] || text).trim();
      text = firstSentence.endsWith('?') ? firstSentence : `${firstSentence}?`;
    }

    // Final cleanups
    text = text.replace(/^\s*\d+\.|^\s*[-*]\s*/g, '').trim();
    return text;
  }, []);

  const addAssistantMessage = useCallback((content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant' && last.content.trim() === content.trim()) {
        return prev;
      }
      return [...prev, { role: 'assistant', content, timestamp: new Date() }];
    });
  }, []);

  const generateFeedback = useCallback(async () => {
    try {
      console.log('🔍 Generating AI feedback for conversation...');
      
      // Convert conversation history to the format expected by the feedback generator
      const transcript = messages.map(msg => ({
        role: msg.role === 'user' ? 'Candidate' : 'Interviewer',
        content: msg.content
      }));

      // Do not generate/save feedback if no answers were provided
      const hasAnyAnswer = messages.some(m => m.role === 'user' && m.content.trim().length > 0);
      if (!hasAnyAnswer) {
        console.warn('Skipping feedback/save: no candidate answers captured.');
        return;
      }

      const realFeedback = await cerebrasLLM.generateInterviewFeedback(
        transcript,
        candidateInfo.role || role,
        candidateInfo.experienceLevel || experienceLevel,
        candidateInfo.techStack || techStack
      );

      // Recalculate total score from category scores to ensure consistency
      const computedTotal = Array.isArray(realFeedback.categoryScores) && realFeedback.categoryScores.length > 0
        ? Math.round(
            realFeedback.categoryScores.reduce((sum: number, c: { score: number }) => sum + (c.score || 0), 0) /
            realFeedback.categoryScores.length
          )
        : 0;

      const normalizedFeedback = {
        ...realFeedback,
        totalScore: computedTotal,
      };

      console.log('✅ AI feedback generated successfully:', normalizedFeedback);
      setFeedback(normalizedFeedback);

      // Save the interview with AI-generated feedback
      const startMs = interviewStartTimeRef.current;
      const durationMinutes = (() => {
        if (startMs) {
          const diff = Math.max(0, Date.now() - startMs);
          return Math.round(diff / 60000);
        }
        if (messages.length >= 2) {
          const first = messages[0].timestamp.getTime();
          const last = messages[messages.length - 1].timestamp.getTime();
          const diff = Math.max(0, last - first);
          return Math.round(diff / 60000);
        }
        return 0;
      })();
      const result = await saveCompletedInterview({
        interviewId,
        candidateName: candidateInfo.name || userName,
        targetRole: candidateInfo.role || '',
        experienceLevel: candidateInfo.experienceLevel || '',
        techStack: candidateInfo.techStack || [],
        totalScore: normalizedFeedback.totalScore,
        categoryScores: normalizedFeedback.categoryScores,
        strengths: normalizedFeedback.strengths,
        areasForImprovement: normalizedFeedback.areasForImprovement,
        finalAssessment: normalizedFeedback.finalAssessment,
        conversationHistory: messages,
        duration: durationMinutes
      });

      if (result.success) {
        console.log('✅ Interview with AI feedback saved successfully:', result.interviewId);
        // Show completion message for a few seconds, then redirect
        setTimeout(() => {
          router.push('/');
        }, 5000);
      }
      
    } catch (error) {
      console.error('🚨 FAILED to generate AI feedback:', error);
      setFeedback({
        error: true,
        totalScore: 0,
        categoryScores: [],
        strengths: [],
        areasForImprovement: [],
        finalAssessment: `❌ Failed to generate AI feedback. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support.`
      });
    }
  }, [messages, candidateInfo, role, experienceLevel, techStack, interviewId, userName, router, cerebrasLLM]);

  // Initialize with greeting - only when user clicks start
  useEffect(() => {
    if (interviewPhase === 'greeting' && !currentQuestion && hasUserInteracted) {
      if (!interviewStartTimeRef.current) {
        interviewStartTimeRef.current = Date.now();
      }
      startGreeting();
    }
  }, [interviewPhase, currentQuestion, hasUserInteracted]);

  // Handle feedback generation when interview is completed
  useEffect(() => {
    if (interviewCompleted && interviewPhase === 'feedback' && !feedback) {
      generateFeedback();
    }
  }, [interviewCompleted, interviewPhase, feedback, generateFeedback]);

  const startGreeting = useCallback(async () => {
    setIsLoading(true);
    try {
      const greeting = await cerebrasLLM.generateConversationalResponse(
        "Starting interview session",
        `You are a professional AI interviewer starting a technical interview session. 

Generate a warm, professional greeting that:
1. Welcomes the candidate
2. Briefly explains you're an AI interviewer
3. Asks for their name and what role they're targeting
4. Keeps it conversational and friendly
5. Should be spoken aloud, so avoid special characters

Respond with ONLY the greeting message, no additional text.`,
        'preliminary'
      );
      
      setCurrentQuestion(greeting);
      setCurrentMessage(greeting);
      
      // Speak the greeting first, then add to conversation history
      await speak(greeting);
      
      // Add to conversation history after speaking (dedup)
      addAssistantMessage(greeting);
      setAwaitingAnswer(true);
      
    } catch (error) {
      console.error('Error generating greeting:', error);
      setCurrentQuestion("Hello! I'm your AI interviewer today. Welcome to the session! Could you please tell me your name and what role you're targeting for this interview?");
    } finally {
      setIsLoading(false);
    }
  }, [cerebrasLLM]);

  const fetchFirstQuestion = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isGeneratingQuestionRef.current) return;
      isGeneratingQuestionRef.current = true;
      const question = await cerebrasLLM.generateInterviewQuestion({
        role: candidateInfo.role || role,
        experienceLevel: candidateInfo.experienceLevel || experienceLevel,
        techStack: candidateInfo.techStack || techStack,
        questionNumber: 1,
        totalQuestions: candidateInfo.questionCount || totalQuestions
      });
      const singleQuestion = sanitizeToSingleQuestion(question);
      
      setCurrentQuestion(singleQuestion);
      setQuestions([singleQuestion]);
      
      // Add to conversation history
      const message: Message = {
        role: 'assistant',
        content: singleQuestion,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
      setAwaitingAnswer(true);
      
    } catch (error) {
      console.error('Error generating first question:', error);
      setCurrentQuestion("What is your experience with the technologies you mentioned?");
    } finally {
      setIsLoading(false);
      isGeneratingQuestionRef.current = false;
    }
  }, [candidateInfo, role, experienceLevel, techStack, totalQuestions, cerebrasLLM, sanitizeToSingleQuestion]);

  const speak = useCallback(async (text: string): Promise<void> => {
    console.log('🤖 TTS:', text);
    setIsSpeaking(true);
    
    try {
      // Try Cartesia TTS first
      const response = await fetch('/api/cartesia/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice_id: 'bf0a246a-8642-498a-9950-80c35e9276b5',
          language: 'en',
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        try {
          await playAudio(audioBlob, text);
          setTtsStatus('cartesia');
        } catch (playError) {
          console.warn('Audio play failed, using browser speech:', playError);
          setTtsStatus('browser');
          fallbackSpeak(text);
        }
      } else {
        // Check if it's a credit limit error
        if (response.status === 402) {
          console.warn('Cartesia TTS credit limit reached, using browser speech');
        } else {
          console.warn('TTS service unavailable, using browser speech');
        }
        setTtsStatus('browser');
        fallbackSpeak(text);
      }
    } catch (error) {
      console.warn('TTS request failed, using browser speech:', error);
      setTtsStatus('browser');
      // Fallback to browser speech synthesis
      fallbackSpeak(text);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const playAudio = useCallback((audioBlob: Blob, text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audio.onloadeddata = () => {
        audio.play().then(() => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
        }).catch((playError) => {
          console.error('Audio play failed:', playError);
          // If autoplay is blocked, fall back to browser speech
          fallbackSpeak(text);
          URL.revokeObjectURL(audioUrl);
          resolve();
        });
      };
      
      audio.onerror = () => {
        console.error('Audio load failed, using browser speech');
        fallbackSpeak(text);
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      
      audio.src = audioUrl;
    });
  }, []);

  const fallbackSpeak = useCallback((text: string): void => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    // Stop any ongoing audio
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }, []);

  const endInterview = useCallback(() => {
    // Stop any ongoing audio
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    // Stop any ongoing listening
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
      (window as any).currentRecognition = null;
    }
    // Set states to end the interview
    setIsSpeaking(false);
    setIsListening(false);
    setIsLoading(false);
    setInterviewCompleted(true);
    setInterviewPhase('feedback');
  }, []);

  const listen = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          reject(new Error('Speech recognition not supported'));
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening until manually stopped
        recognition.interimResults = true; // Show interim results
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Don't display candidate's speech on main screen - only capture for conversation history
        };

        recognition.onerror = (event: any) => {
          reject(new Error(`Speech recognition error: ${event.error}`));
        };

        recognition.onend = () => {
          resolve(finalTranscript.trim());
        };

        recognition.start();
        
        // Store recognition instance for manual stopping
        (window as any).currentRecognition = recognition;
        
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const stopListening = useCallback(() => {
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
      (window as any).currentRecognition = null;
    }
    setIsListening(false);
  }, []);

  const handleAnswer = useCallback(async () => {
    if (isListening || !awaitingAnswer) return;

    setIsListening(true);
    setIsLoading(false);
    setHasUserInteracted(true); // Mark that user has interacted for audio
    
    try {
      // Capture candidate's spoken answer
      const answer = await listen();
      
      if (answer && answer.trim()) {
        // Add to conversation history
        const message: Message = {
          role: 'user',
          content: answer,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
        setAwaitingAnswer(false);

        // Handle different phases - we'll call the functions directly
        if (interviewPhase === 'greeting') {
          // Handle greeting response inline
          try {
            const response = await cerebrasLLM.generateConversationalResponse(
              answer,
              `The user just responded to your greeting. Extract their name and target role from their response, then ask the next preliminary question.

User response: "${answer}"

Generate a response that:
1. Acknowledges their name and role if provided
2. Asks about their experience level (Junior, Mid-level, Senior)
3. Is conversational and natural
4. Will be spoken aloud

Respond with ONLY the next question/response, no additional text.`,
              'preliminary'
            );
            
            setCurrentQuestion(response);
            setCurrentMessage(response);
            setInterviewPhase('preliminary');
            
            // Speak the response first, then add to conversation history
            await speak(response);
            
            // Add to conversation history after speaking (dedup)
            addAssistantMessage(response);
            setAwaitingAnswer(true);
            
            // Extract and store candidate info
            const extractedInfo = extractCandidateInfo(answer);
            setCandidateInfo(prev => ({ ...prev, ...extractedInfo }));
            
          } catch (error) {
            console.error('Error handling greeting response:', error);
            const fallbackMessage = "Thank you! Now, what experience level would you say you're at - Junior, Mid-level, or Senior?";
            setCurrentMessage(fallbackMessage);
            setInterviewPhase('preliminary');
            await speak(fallbackMessage);
          }
        } else if (interviewPhase === 'preliminary') {
          // Handle preliminary response inline
          const conversationHistory = messages
            .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
            .join('\n');

          try {
            const response = await cerebrasLLM.generateConversationalResponse(
              answer,
              `You are conducting preliminary questions before a technical interview. 

Conversation so far:
${conversationHistory}

Current candidate response: "${answer}"

Based on the conversation, determine what preliminary information you still need:
- Name and target role
- Experience level (Junior/Mid/Senior)  
- Preferred tech stack/technologies
- Type of interview they want (technical, behavioral, or mixed)
- How many questions they'd like (suggest 5-7)

If you have all the information needed, say "Let's begin the interview" or "Now let's start with the first question" to transition.
If you need more information, ask the next logical preliminary question.

Generate a natural, conversational response that will be spoken aloud.
Respond with ONLY the response, no additional text.`,
              'preliminary'
            );

            setCurrentQuestion(response);
            setCurrentMessage(response);

            // Speak the response first
            await speak(response);

            // Check if we should transition to interview phase
            if (response.toLowerCase().includes('let\'s begin') || 
                response.toLowerCase().includes('start the interview') ||
                response.toLowerCase().includes('first question') ||
                response.toLowerCase().includes('move forward with the actual interview') ||
                response.toLowerCase().includes('proceed with the') ||
                response.toLowerCase().includes('begin the interview') ||
                response.toLowerCase().includes('we can proceed') ||
                response.toLowerCase().includes('let\'s go ahead') ||
                response.toLowerCase().includes('move on to the') ||
                response.toLowerCase().includes('confirmed that i have all')) {
              
              // Just transition to interview phase, don't generate question yet
              setInterviewPhase('interview');
              setCurrentQuestionIndex(0);
              interviewTargetQuestionsRef.current = Math.max(1, Number(candidateInfo.questionCount || totalQuestions));
              console.log('🎯 Set target questions to:', interviewTargetQuestionsRef.current, 'from candidateInfo.questionCount:', candidateInfo.questionCount, 'totalQuestions:', totalQuestions);
              setAwaitingAnswer(true);
              return;
            }

            // Add to conversation history after speaking (dedup)
            addAssistantMessage(response);
            setAwaitingAnswer(true);

            // Extract and store candidate info
            const extractedInfo = extractCandidateInfo(answer);
            setCandidateInfo(prev => ({ ...prev, ...extractedInfo }));
            
          } catch (error) {
            console.error('Error handling preliminary response:', error);
            const fallbackMessage = "That's helpful information. Let's begin the technical interview. Are you ready for the first question?";
            setCurrentMessage(fallbackMessage);
            setInterviewPhase('interview');
            setCurrentQuestionIndex(0);
            interviewTargetQuestionsRef.current = Math.max(1, Number(candidateInfo.questionCount || totalQuestions));
            setAwaitingAnswer(true);
            
            // Generate first interview question
            if (!isGeneratingQuestionRef.current) {
              isGeneratingQuestionRef.current = true;
            }
            const questionRaw = await cerebrasLLM.generateInterviewQuestion({
              role: candidateInfo.role || role,
              experienceLevel: candidateInfo.experienceLevel || experienceLevel,
              techStack: candidateInfo.techStack || techStack,
              questionNumber: 1,
              totalQuestions: interviewTargetQuestionsRef.current
            });
            const question = sanitizeToSingleQuestion(questionRaw);
            
            setCurrentQuestion(question);
            setQuestions([question]);
            
            // Speak only the question (fallback message is just for display)
            await speak(question);
            
            // Add to conversation history after speaking (dedup)
            addAssistantMessage(question);
            setAwaitingAnswer(true);
            isGeneratingQuestionRef.current = false;
          }
        } else if (interviewPhase === 'interview') {
          // Handle interview response inline
          setAnswers(prev => [...prev, answer]);
          
          // Check if this is the first question (no questions asked yet)
          if (currentQuestionIndex === 0 && questions.length === 0) {
            // Generate first interview question
            if (isGeneratingQuestionRef.current) return;
            isGeneratingQuestionRef.current = true;
            const firstQuestionRaw = await cerebrasLLM.generateInterviewQuestion({
              role: candidateInfo.role || role,
              experienceLevel: candidateInfo.experienceLevel || experienceLevel,
              techStack: candidateInfo.techStack || techStack,
              questionNumber: 1,
              totalQuestions: interviewTargetQuestionsRef.current
            });
            const firstQuestion = sanitizeToSingleQuestion(firstQuestionRaw);
            
            setCurrentQuestion(firstQuestion);
            setCurrentMessage(firstQuestion);
            setQuestions([firstQuestion]);
            
            // Speak the first question
            await speak(firstQuestion);
            
            // Add to conversation history after speaking
            addAssistantMessage(firstQuestion);
            setAwaitingAnswer(true);
            isGeneratingQuestionRef.current = false;
            return;
          }
          
          // Check if we've reached the total number of questions
          const targetQuestions = interviewTargetQuestionsRef.current;
          console.log('🎯 Question check - currentQuestionIndex:', currentQuestionIndex, 'targetQuestions:', targetQuestions, 'should complete:', currentQuestionIndex + 1 >= targetQuestions);
          if (currentQuestionIndex + 1 >= targetQuestions) {
            // Interview completed
            console.log('🎯 Interview completed! Moving to feedback phase.');
            setInterviewCompleted(true);
            setInterviewPhase('feedback');
            return;
          }

          // Generate next question from Cerebras
          const nextQuestionIndex = currentQuestionIndex + 1;
          if (isGeneratingQuestionRef.current) return;
          isGeneratingQuestionRef.current = true;
          const nextQuestionRaw = await cerebrasLLM.generateInterviewQuestion({
            role: candidateInfo.role || role,
            experienceLevel: candidateInfo.experienceLevel || experienceLevel,
            techStack: candidateInfo.techStack || techStack,
            previousAnswers: [...answers, answer],
            questionNumber: nextQuestionIndex + 1,
            totalQuestions: interviewTargetQuestionsRef.current
          });
          const nextQuestion = sanitizeToSingleQuestion(nextQuestionRaw);

          setQuestions(prev => [...prev, nextQuestion]);
          setCurrentQuestion(nextQuestion);
          setCurrentMessage(nextQuestion);
          setCurrentQuestionIndex(nextQuestionIndex);
          
          // Speak the next question first
          await speak(nextQuestion);
          
          // Add question to conversation history after speaking (dedup)
          addAssistantMessage(nextQuestion);
          setAwaitingAnswer(true);
          isGeneratingQuestionRef.current = false;
        }
      } else {
        console.log('No speech detected');
        setCurrentMessage('I didn\'t hear anything. Please try again or use text input.');
      }
    } catch (error) {
      console.error('Error processing answer:', error);
      setCurrentMessage('I had trouble hearing you. Please try again or use text input.');
    } finally {
      setIsListening(false);
    }
  }, [isListening, awaitingAnswer, interviewPhase, listen, candidateInfo, currentQuestionIndex, totalQuestions, answers, role, experienceLevel, techStack, cerebrasLLM, speak, sanitizeToSingleQuestion]);


  const extractCandidateInfo = (text: string): Partial<CandidateInfo> => {
    const info: Partial<CandidateInfo> = {};
    
    // Extract name
    const nameMatch = text.match(/(?:my name is|i'm|i am|call me)\s+([a-zA-Z\s]+)/i);
    if (nameMatch) {
      info.name = nameMatch[1].trim();
    }
    
    // Extract role
    const roleMatch = text.match(/(?:role|position|job|targeting|applying for)\s+(?:is\s+)?([a-zA-Z\s]+(?:developer|engineer|designer|manager|analyst))/i);
    if (roleMatch) {
      info.role = roleMatch[1].trim();
    }
    
    // Extract experience level
    if (text.toLowerCase().includes('junior')) {
      info.experienceLevel = 'Junior';
    } else if (text.toLowerCase().includes('senior')) {
      info.experienceLevel = 'Senior';
    } else if (text.toLowerCase().includes('mid')) {
      info.experienceLevel = 'Mid-level';
    }
    
    // Extract tech stack using token approach to avoid regex pitfalls (e.g., c++/c#) and false positives
    const techKeywords = ['javascript', 'react', 'node', 'python', 'java', 'typescript', 'angular', 'vue', 'php', 'ruby', 'go', 'rust', 'c++', 'c#', 'swift', 'kotlin'];
    const tokens = text
      .toLowerCase()
      .split(/[\s,;()\\/]+/)
      .filter(Boolean)
      .map(t => t.replace(/[\.!?]$/, ''));
    const mentionedTech = techKeywords.filter(tech => tokens.includes(tech.toLowerCase()))
      // ensure 'java' does not match when 'javascript' present alone
      .filter(tech => !(tech === 'java' && tokens.includes('javascript')));
    if (mentionedTech.length > 0) {
      info.techStack = mentionedTech.map(tech => tech.charAt(0).toUpperCase() + tech.slice(1));
    }
    
    // Extract question count - look for patterns like "2 questions", "only 2 questions", "ask 2 questions", etc.
    const countMatch = text.match(/(?:only\s+)?(?:ask\s+)?(\d+)\s+questions?/i);
    if (countMatch) {
      info.questionCount = parseInt(countMatch[1]);
      console.log('🎯 Extracted question count:', info.questionCount, 'from text:', text);
    }
    
    return info;
  };

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;
    
    setIsLoading(true);
    setHasUserInteracted(true); // Mark that user has interacted for audio
    if (!awaitingAnswer) { setIsLoading(false); return; }
    
    try {
      const answer = textInput.trim();
      
      // Add to conversation history
      const message: Message = {
        role: 'user',
        content: answer,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
      setAwaitingAnswer(false);

      // Handle different phases inline (same logic as handleAnswer)
      if (interviewPhase === 'greeting') {
        // Handle greeting response inline
        try {
          const response = await cerebrasLLM.generateConversationalResponse(
            answer,
            `The user just responded to your greeting. Extract their name and target role from their response, then ask the next preliminary question.

User response: "${answer}"

Generate a response that:
1. Acknowledges their name and role if provided
2. Asks about their experience level (Junior, Mid-level, Senior)
3. Is conversational and natural
4. Will be spoken aloud

Respond with ONLY the next question/response, no additional text.`,
            'preliminary'
          );
          
          setCurrentQuestion(response);
          setCurrentMessage(response);
          setInterviewPhase('preliminary');
          
          // Speak the response first
          await speak(response);
          
          // Add to conversation history after speaking
          const message: Message = {
            role: 'assistant',
            content: response,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, message]);
          setAwaitingAnswer(true);
          
          // Extract and store candidate info
          const extractedInfo = extractCandidateInfo(answer);
          setCandidateInfo(prev => ({ ...prev, ...extractedInfo }));
          
        } catch (error) {
          console.error('Error handling greeting response:', error);
          const fallbackMessage = "Thank you! Now, what experience level would you say you're at - Junior, Mid-level, or Senior?";
          setCurrentMessage(fallbackMessage);
          setInterviewPhase('preliminary');
          await speak(fallbackMessage);
        }
      } else if (interviewPhase === 'preliminary') {
        // Handle preliminary response inline
        const conversationHistory = messages
          .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
          .join('\n');

        try {
          const response = await cerebrasLLM.generateConversationalResponse(
            answer,
            `You are conducting preliminary questions before a technical interview. 

Conversation so far:
${conversationHistory}

Current candidate response: "${answer}"

Based on the conversation, determine what preliminary information you still need:
- Name and target role
- Experience level (Junior/Mid/Senior)  
- Preferred tech stack/technologies
- Type of interview they want (technical, behavioral, or mixed)
- How many questions they'd like (suggest 5-7)

If you have all the information needed, say "Let's begin the interview" or "Now let's start with the first question" to transition.
If you need more information, ask the next logical preliminary question.

Generate a natural, conversational response that will be spoken aloud.
Respond with ONLY the response, no additional text.`,
            'preliminary'
          );

          setCurrentQuestion(response);
          setCurrentMessage(response);

          // Speak the response first
          await speak(response);

          // Check if we should transition to interview phase
          if (response.toLowerCase().includes('let\'s begin') || 
              response.toLowerCase().includes('start the interview') ||
              response.toLowerCase().includes('first question') ||
              response.toLowerCase().includes('move forward with the actual interview') ||
              response.toLowerCase().includes('proceed with the') ||
              response.toLowerCase().includes('begin the interview') ||
              response.toLowerCase().includes('we can proceed') ||
              response.toLowerCase().includes('let\'s go ahead') ||
              response.toLowerCase().includes('move on to the') ||
              response.toLowerCase().includes('confirmed that i have all')) {
            
            // Just transition to interview phase, don't generate question yet
            setInterviewPhase('interview');
            setCurrentQuestionIndex(0);
            interviewTargetQuestionsRef.current = Math.max(1, Number(candidateInfo.questionCount || totalQuestions));
            setAwaitingAnswer(true);
            
            setTextInput('');
            setShowTextInput(false);
            return;
          }

          // Add to conversation history after speaking
          const message: Message = {
            role: 'assistant',
            content: response,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, message]);
          setAwaitingAnswer(true);

          // Extract and store candidate info
          const extractedInfo = extractCandidateInfo(answer);
          setCandidateInfo(prev => ({ ...prev, ...extractedInfo }));
          
          } catch (error) {
            console.error('Error handling preliminary response:', error);
            const fallbackMessage = "That's helpful information. Let's begin the technical interview. Are you ready for the first question?";
            setCurrentMessage(fallbackMessage);
            setInterviewPhase('interview');
            setCurrentQuestionIndex(0);
            setAwaitingAnswer(true);
            
            // Generate first interview question
            if (!isGeneratingQuestionRef.current) {
              isGeneratingQuestionRef.current = true;
            }
            const questionRaw = await cerebrasLLM.generateInterviewQuestion({
              role: candidateInfo.role || role,
              experienceLevel: candidateInfo.experienceLevel || experienceLevel,
              techStack: candidateInfo.techStack || techStack,
              questionNumber: 1,
              totalQuestions: candidateInfo.questionCount || totalQuestions
            });
            const question = sanitizeToSingleQuestion(questionRaw);
            
            setCurrentQuestion(question);
          setQuestions([question]);
            
            // Speak only the question (fallback message is just for display)
            await speak(question);
            
            // Add to conversation history after speaking
            const questionMessage: Message = {
              role: 'assistant',
              content: question,
              timestamp: new Date()
            };
          setMessages(prev => [...prev, questionMessage]);
          setAwaitingAnswer(true);
            isGeneratingQuestionRef.current = false;
          }
      } else if (interviewPhase === 'interview') {
        // Handle interview response inline
        setAnswers(prev => [...prev, answer]);
        
        // Check if this is the first question (no questions asked yet)
        if (currentQuestionIndex === 0 && questions.length === 0) {
          // Generate first interview question
          if (isGeneratingQuestionRef.current) return;
          isGeneratingQuestionRef.current = true;
          const firstQuestionRaw = await cerebrasLLM.generateInterviewQuestion({
            role: candidateInfo.role || role,
            experienceLevel: candidateInfo.experienceLevel || experienceLevel,
            techStack: candidateInfo.techStack || techStack,
            questionNumber: 1,
            totalQuestions: interviewTargetQuestionsRef.current
          });
          const firstQuestion = sanitizeToSingleQuestion(firstQuestionRaw);
          
          setCurrentQuestion(firstQuestion);
          setCurrentMessage(firstQuestion);
          setQuestions([firstQuestion]);
          
          // Speak the first question
          await speak(firstQuestion);
          
          // Add to conversation history after speaking
          const questionMessage: Message = {
            role: 'assistant',
            content: firstQuestion,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, questionMessage]);
          setAwaitingAnswer(true);
          
          setTextInput('');
          setShowTextInput(false);
          isGeneratingQuestionRef.current = false;
          return;
        }
        
        // Check if we've reached the total number of questions
        const targetQuestions = interviewTargetQuestionsRef.current;
        console.log('🎯 Question check (text) - currentQuestionIndex:', currentQuestionIndex, 'targetQuestions:', targetQuestions, 'should complete:', currentQuestionIndex + 1 >= targetQuestions);
        if (currentQuestionIndex + 1 >= targetQuestions) {
          // Interview completed
          console.log('🎯 Interview completed! Moving to feedback phase.');
          setInterviewCompleted(true);
          setInterviewPhase('feedback');
          
          setTextInput('');
          setShowTextInput(false);
          return;
        }

        // Generate next question from Cerebras
        const nextQuestionIndex = currentQuestionIndex + 1;
        if (isGeneratingQuestionRef.current) return;
        isGeneratingQuestionRef.current = true;
        const nextQuestionRaw = await cerebrasLLM.generateInterviewQuestion({
          role: candidateInfo.role || role,
          experienceLevel: candidateInfo.experienceLevel || experienceLevel,
          techStack: candidateInfo.techStack || techStack,
          previousAnswers: [...answers, answer],
          questionNumber: nextQuestionIndex + 1,
          totalQuestions: interviewTargetQuestionsRef.current
        });
        const nextQuestion = sanitizeToSingleQuestion(nextQuestionRaw);

        setQuestions(prev => [...prev, nextQuestion]);
        setCurrentQuestion(nextQuestion);
        setCurrentMessage(nextQuestion);
        setCurrentQuestionIndex(nextQuestionIndex);
        
        // Speak the next question first
        await speak(nextQuestion);
        
        // Add question to conversation history after speaking
        const questionMessage: Message = {
          role: 'assistant',
          content: nextQuestion,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, questionMessage]);
        setAwaitingAnswer(true);
        isGeneratingQuestionRef.current = false;
      }
      
      setTextInput('');
      setShowTextInput(false);
    } catch (error) {
      console.error('Error processing text input:', error);
    } finally {
      setIsLoading(false);
    }
  }, [textInput, awaitingAnswer, interviewPhase, candidateInfo, currentQuestionIndex, totalQuestions, answers, role, experienceLevel, techStack, cerebrasLLM, speak, sanitizeToSingleQuestion]);


  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      {/* Interview Status */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">AI Interview Session</h2>
        <p className="text-gray-600 mb-2">
          {interviewPhase === 'greeting' && !hasUserInteracted && "Ready to start your AI interview"}
          {interviewPhase === 'greeting' && hasUserInteracted && "Welcome! Let's get started"}
          {interviewPhase === 'preliminary' && "Gathering your preferences"}
          {interviewPhase === 'interview' && `Question ${currentQuestionIndex + 1} of ${candidateInfo.questionCount || totalQuestions}`}
          {interviewPhase === 'feedback' && "Interview completed"}
        </p>
        {interviewPhase === 'interview' && (
          <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
            Role: {candidateInfo.role || role} | Level: {candidateInfo.experienceLevel || experienceLevel} | Tech: {(candidateInfo.techStack || techStack).join(', ')}
          </div>
        )}
        {interviewPhase === 'greeting' && !hasUserInteracted && (
          <div className="text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-full inline-block">
            Click "Start Interview" to begin
          </div>
        )}
        {ttsStatus === 'browser' && (
          <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
            🔊 Using browser speech synthesis
          </div>
        )}
      </div>

      {/* Interview Interface */}
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image 
              src="/ai-avatar.png" 
              alt="AI Interviewer" 
              width={65} 
              height={54} 
              className="object-cover" 
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <div className="avatar">
              <Image 
                src="/user-avatar.png" 
                alt="user avatar" 
                width={540} 
                height={540} 
                className="rounded-full object-cover size-[120px]" 
              />
              {isListening && <span className="animate-speak" />}
            </div>
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {/* Current Message Display */}
      {currentMessage && !interviewCompleted && (
        <div className="transcript-border max-w-2xl">
          <div className="transcript">
            <p className={cn(
              'transition-opacity duration-500',
              isLoading ? 'opacity-50' : 'opacity-100'
            )}>
              {isLoading ? 'Generating next question...' : currentMessage}
            </p>
          </div>
        </div>
      )}

      {/* Voice Status */}
      {!interviewCompleted && (
        <div className="text-center text-sm bg-white/70 backdrop-blur-sm rounded-lg p-3 border">
          {isListening ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-700 font-medium">🎤 Listening... Speak your answer</span>
              </div>
              <p className="text-xs text-gray-600">Click "Stop Listening" when you're done speaking</p>
            </div>
          ) : isSpeaking ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">🔊 AI is speaking...</span>
              </div>
              <p className="text-xs text-gray-600">You can stop the AI if needed</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-700 font-medium">🤖 Processing your response...</span>
            </div>
          ) : (
            <span className="text-gray-700">
              {interviewPhase === 'greeting' && !hasUserInteracted 
                ? "Click 'Start Interview' to begin" 
                : "Click 'Start Answering' to begin recording your response"
              }
            </span>
          )}
        </div>
      )}

      {/* Control Buttons */}
      {!interviewCompleted && (
        <div className="flex flex-col space-y-2">
          {interviewPhase === 'greeting' && !hasUserInteracted ? (
            <div className="flex flex-col space-y-2">
              <button 
                className="btn-call"
                onClick={() => {
                  setHasUserInteracted(true);
                }}
                disabled={isLoading}
              >
                Start Interview
              </button>
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              {/* Main Action Button */}
              <div className="flex space-x-3">
                {!isListening && !isSpeaking ? (
                  <button 
                    className="btn-disconnect"
                    onClick={handleAnswer}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 
                     interviewPhase === 'greeting' ? 'Start Answering' :
                     interviewPhase === 'preliminary' ? 'Start Answering' :
                     'Start Answering'}
                  </button>
                ) : isListening ? (
                  <button 
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors animate-pulse"
                    onClick={stopListening}
                  >
                    🛑 Stop Listening
                  </button>
                ) : isSpeaking ? (
                  <button 
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    onClick={stopSpeaking}
                  >
                    🔇 Stop AI Speaking
                  </button>
                ) : null}
              </div>
              
              {/* Secondary Actions */}
              {!isListening && !isSpeaking && (
                <div className="flex space-x-2">
                  <button 
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    onClick={() => setShowTextInput(!showTextInput)}
                  >
                    {showTextInput ? 'Hide Text Input' : 'Type Your Answer'}
                  </button>
                  
                  <button 
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    onClick={endInterview}
                  >
                    🛑 End Interview
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Text Input Fallback */}
      {showTextInput && !interviewCompleted && (
        <div className="w-full max-w-md">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Type Your Answer</h4>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-20"
              disabled={isLoading}
            />
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={() => setShowTextInput(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || isLoading}
                className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isLoading ? 'Processing...' : 'Submit & Next Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation History */}
      {messages.length > 0 && (
        <div className="w-full max-w-4xl mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Conversation History</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-lg border">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'p-4 rounded-lg shadow-sm border',
                  message.role === 'user' 
                    ? 'bg-blue-50/90 border-blue-200 ml-8' 
                    : 'bg-gray-50/90 border-gray-200 mr-8'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "font-semibold text-sm",
                    message.role === 'user' ? 'text-blue-700' : 'text-gray-700'
                  )}>
                    {message.role === 'user' ? '👤 You' : '🤖 AI Interviewer'}
                  </span>
                  <span className="text-xs text-gray-500 bg-white/50 px-2 py-1 rounded">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{message.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interview Completion & Feedback */}
      {interviewCompleted && feedback && (
        <div className="w-full max-w-4xl mt-8">
          <div className="card-border">
            <div className={`dark-gradient rounded-2xl p-6 ${feedback.error ? 'border border-red-500/30' : ''}`}>
          <div className="text-center mb-6">
            <h3 className={`text-2xl font-bold mb-2 ${feedback.error ? 'text-red-400' : 'text-primary-100'}`}>
              {feedback.error ? '⚠️ Feedback Generation Failed' : '🎉 Interview Completed!'}
            </h3>
            <p className={feedback.error ? 'text-red-300' : 'text-light-100'}>
              {feedback.error ? 'Unable to generate AI feedback' : 'Thank you for completing the interview. Here\'s your AI feedback:'}
            </p>
          </div>
          
          {!feedback.error ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-lg text-primary-100">Overall Score: {feedback.totalScore}/100</h4>
                  <div className="space-y-2">
                    {feedback.categoryScores.map((category, index) => (
                      <div key={index} className="border border-input rounded p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">{category.name}</span>
                          <span className="font-bold text-primary-200">{category.score}/100</span>
                        </div>
                        <p className="text-xs text-light-400">{category.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-lg text-success-100">Strengths</h4>
                  {Array.isArray(feedback.strengths) && feedback.strengths.length > 0 && (
                    <ul className="text-sm space-y-1 mb-4">
                      {feedback.strengths.map((strength: string, index: number) => (
                        <li key={index} className="text-success-100">• {strength}</li>
                      ))}
                    </ul>
                  )}
                  
                  <h4 className="font-semibold mb-2 text-lg text-orange-400">Areas for Improvement</h4>
                  {Array.isArray(feedback.areasForImprovement) && feedback.areasForImprovement.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {feedback.areasForImprovement.map((area: string, index: number) => (
                        <li key={index} className="text-orange-400">• {area}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              
              <div className="mt-6 border border-input rounded p-4">
                <h4 className="font-semibold mb-2 text-lg text-primary-100">🤖 AI Assessment</h4>
                <p className="text-sm text-light-100">{feedback.finalAssessment}</p>
              </div>
            </>
          ) : (
            <div className="border border-red-500/30 p-6 rounded-lg">
              <h4 className="font-semibold mb-2 text-lg text-red-400">Error Details</h4>
              <p className="text-sm text-red-300 mb-4">{feedback.finalAssessment}</p>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              {feedback.error ? 'You can try the interview again' : 'Redirecting to homepage in 5 seconds...'}
            </p>
            <button
              onClick={() => router.push('/')}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${
                feedback.error 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {feedback.error ? 'Try Again' : 'Go to Homepage Now'}
            </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
