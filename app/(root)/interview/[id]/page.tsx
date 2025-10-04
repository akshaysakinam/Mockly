import { getInterviewById } from '@/lib/actions/interview.action';
import { notFound } from 'next/navigation';

export default async function InterviewDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const interview = await getInterviewById(id);
  if (!interview) return notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 space-y-6">
      <div className="card-border">
        <div className="dark-gradient rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{interview.targetRole}</h1>
              <p className="text-light-400 text-sm">{interview.experienceLevel} level</p>
            </div>
            <div className="text-right">
              {typeof interview.totalScore === 'number' && interview.totalScore > 0 && (
                <>
                  <div className="text-3xl font-bold text-primary-200">{interview.totalScore}/100</div>
                  <div className="text-xs text-light-400">Overall Score</div>
                </>
              )}
            </div>
          </div>

          {Array.isArray(interview.techStack) && interview.techStack.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {interview.techStack.map((tech, i) => (
                <span key={i} className="px-2 py-1 bg-dark-200 text-primary-200 text-xs rounded-full border border-input">{tech}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-border">
          <div className="dark-gradient rounded-2xl p-4">
            <h2 className="font-semibold mb-2">Category Scores</h2>
            <div className="space-y-2">
              {Array.isArray(interview.categoryScores) && interview.categoryScores.length > 0 && (
                interview.categoryScores.map((c, i) => (
                  <div key={i} className="border border-input rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="font-bold text-primary-200">{c.score}/100</span>
                    </div>
                    <p className="text-xs text-light-400">{c.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="card-border">
          <div className="dark-gradient rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold">Summary</h2>
            {Array.isArray(interview.strengths) && interview.strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-success-100">Strengths</h3>
                <ul className="text-sm text-success-100 list-disc ml-5">
                  {interview.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(interview.areasForImprovement) && interview.areasForImprovement.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-orange-400">Areas for Improvement</h3>
                <ul className="text-sm text-orange-400 list-disc ml-5">
                  {interview.areasForImprovement.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-border">
        <div className="dark-gradient rounded-2xl p-4">
          <h2 className="font-semibold mb-2">AI Assessment</h2>
          <p className="text-sm text-light-100">{interview.finalAssessment}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-light-400">
        <span>{new Date(interview.completedAt).toLocaleString()}</span>
        {typeof interview.duration === 'number' && interview.duration > 0 && (
          <span>Duration: {interview.duration} min</span>
        )}
      </div>

      <div className="card-border">
        <div className="dark-gradient rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Conversation History</h2>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {interview.conversationHistory.map((m, i) => (
              <div key={i} className={`p-3 rounded border ${m.role === 'user' ? 'bg-dark-200 border-blue-400/30' : 'bg-dark-200 border-gray-400/30'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${m.role === 'user' ? 'text-blue-300' : 'text-light-100'}`}>{m.role === 'user' ? 'You' : 'AI Interviewer'}</span>
                  <span className="text-[10px] text-light-400">{new Date(m.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-light-100">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


