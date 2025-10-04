"use server";

import { db } from "@/firebase/admin";
import { getCurrentUser } from "./auth.action";

export interface CompletedInterview {
  id: string;
  userId: string;
  interviewId: string;
  candidateName: string;
  targetRole: string;
  experienceLevel: string;
  techStack: string[];
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  completedAt: Date;
  duration: number; // in minutes
}

export async function saveCompletedInterview(interviewData: Omit<CompletedInterview, 'id' | 'userId' | 'completedAt'>): Promise<{ success: boolean; message: string; interviewId?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        message: "User not authenticated"
      };
    }

    const interview: Omit<CompletedInterview, 'id'> = {
      ...interviewData,
      userId: user.id,
      completedAt: new Date(),
    };

    const docRef = await db.collection('completed_interviews').add(interview);
    
    return {
      success: true,
      message: "Interview saved successfully",
      interviewId: docRef.id
    };
  } catch (error) {
    console.error("Error saving interview:", error);
    return {
      success: false,
      message: "Failed to save interview"
    };
  }
}

export async function getUserCompletedInterviews(): Promise<CompletedInterview[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    // First, get all interviews for the user (without orderBy to avoid index requirement)
    const snapshot = await db
      .collection('completed_interviews')
      .where('userId', '==', user.id)
      .limit(50) // Get more records to sort client-side
      .get();

    const interviews: CompletedInterview[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      interviews.push({
        id: doc.id,
        ...data,
        completedAt: data.completedAt.toDate(),
        conversationHistory: data.conversationHistory.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp.toDate()
        }))
      } as CompletedInterview);
    });

    // Sort client-side by completedAt descending and limit to 10
    return interviews
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .slice(0, 10);

  } catch (error) {
    console.error("Error fetching user interviews:", error);
    return [];
  }
}

export async function getInterviewById(interviewId: string): Promise<CompletedInterview | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const doc = await db.collection('completed_interviews').doc(interviewId).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    
    // Check if the interview belongs to the current user
    if (data.userId !== user.id) {
      return null;
    }

    return {
      id: doc.id,
      ...data,
      completedAt: data.completedAt.toDate(),
      conversationHistory: data.conversationHistory.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp.toDate()
      }))
    } as CompletedInterview;
  } catch (error) {
    console.error("Error fetching interview:", error);
    return null;
  }
}
