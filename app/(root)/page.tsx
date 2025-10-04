import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { getUserCompletedInterviews } from "@/lib/actions/interview.action";

async function Home() {
  const completedInterviews = await getUserCompletedInterviews();
  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Practice real interview questions & get instant feedback
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="robo-dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Your Completed Interviews</h2>

        {completedInterviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedInterviews.map((interview) => (
              <Link
                href={`/interview/${interview.id}`}
                key={interview.id}
                className="card-border cursor-pointer hover:opacity-95 hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                <div className="card-interview">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="hover:underline">{interview.targetRole}</h3>
                      <p className="text-light-400 text-sm mt-1">{interview.experienceLevel} level</p>
                    </div>
                    <div className="text-right">
                    {typeof interview.totalScore === 'number' && interview.totalScore > 0 && (
                      <>
                        <div className="text-3xl font-bold text-primary-200">{interview.totalScore}/100</div>
                        <div className="text-xs text-light-400">Score</div>
                      </>
                    )}
                    </div>
                  </div>

                  <div>
                    {Array.isArray(interview.techStack) && interview.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {interview.techStack.map((tech, index) => (
                          <span key={index} className="px-2 py-1 bg-dark-200 text-primary-200 text-xs rounded-full border border-input">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    {Array.isArray(interview.strengths) && interview.strengths.length > 0 && (
                      <>
                        <h4 className="badge-text text-light-100">Top strengths</h4>
                        <ul className="text-sm text-success-100 list-disc ml-5 mt-2">
                          {interview.strengths.slice(0, 2).map((strength, index) => (
                            <li key={index}>{strength}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-light-400">
                    <span>{new Date(interview.completedAt).toLocaleDateString()}</span>
                    {typeof interview.duration === 'number' && interview.duration > 0 && (
                      <span>{interview.duration} min</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card-border mx-auto max-w-md">
            <div className="dark-gradient rounded-2xl p-8 text-center">
              <p className="text-light-100 mb-4">You haven&apos;t completed any interviews yet</p>
              <Button asChild className="btn-primary">
                <Link href="/interview">Take Your First Interview</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

    
    </>
  );
}

export default Home;
