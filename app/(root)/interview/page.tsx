import InterviewRoom from "@/components/InterviewRoom";
// import { getCurrentUser } from "@/lib/actions/auth.action";

const Page = async () => {
  // const user = await getCurrentUser();

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-foreground mb-4">AI Interview Platform</h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Experience truly dynamic AI-powered interviews with Cerebras-generated questions and real-time voice interaction. 
                    The AI interviewer will ask personalized questions based on your role, experience level, and tech stack.
                </p>
                {/* Requested: remove New Architecture block */}
            </div>

            <InterviewRoom 
                userName="Candidate" 
                userId="user1" 
                interviewId="cerebras-interview-1"
                role="Front-end Developer"
                experienceLevel="Mid-level"
                techStack={["JavaScript", "React", "TypeScript", "Node.js"]}
            />
        </div>
    )
};

export default Page;
