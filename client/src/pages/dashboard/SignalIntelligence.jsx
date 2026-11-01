import { useEffect, useState } from 'react';
import { Activity, Brain, BarChart3, Save, Sparkles } from 'lucide-react';
import { aiAPI, postsAPI, usersAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const Section = ({ title, items = [] }) => (
  <section className="card" style={{ padding: '1.25rem' }}>
    <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
    {items.length ? (
      <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    ) : <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>No evidence found for this discussion.</p>}
  </section>
);

const Evidence = ({ items = [], comments = [] }) => {
  const commentById = new Map(comments.map((comment) => [comment._id, comment]));
  const references = items.flatMap((item) => item.commentIds.map((commentId) => ({
    ...item,
    commentId,
    comment: commentById.get(commentId),
  }))).filter((item) => item.comment);
  return (
    <section className="card" style={{ padding: '1.25rem' }}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Supporting comments</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Direct observations are linked to the comments that support them. AI interpretation is labeled separately.</p>
      {references.length ? references.map((item) => (
        <button
          type="button"
          key={`${item.commentId}-${item.insight}`}
          onClick={() => document.getElementById(`signal-comment-${item.commentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem', marginTop: '0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <strong>AI interpretation:</strong> {item.insight}<br />
          <span style={{ fontSize: '0.8rem' }}>View comment {item.commentId.slice(-6)}</span>
        </button>
      )) : <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>No supporting comment references were returned.</p>}
    </section>
  );
};

export default function SignalIntelligence() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [selectedPost, setSelectedPost] = useState('');
  const [pulse, setPulse] = useState(null);
  const [audience, setAudience] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState('');

  useEffect(() => {
    if (!user?._id) return;
    usersAPI.getUserPosts(user._id, { limit: 30 })
      .then((response) => {
        const ownedPosts = response.data.data.posts || [];
        setPosts(ownedPosts);
        if (ownedPosts[0]) setSelectedPost(ownedPosts[0]._id);
      })
      .catch(() => toast({ message: 'Could not load your posts', type: 'error' }));
  }, [user?._id, toast]);

  useEffect(() => {
    if (!selectedPost) {
      setComments([]);
      return;
    }
    postsAPI.getComments(selectedPost)
      .then((response) => setComments(response.data.data.comments || []))
      .catch(() => toast({ message: 'Could not load supporting comments', type: 'error' }));
  }, [selectedPost, toast]);

  const run = async (type) => {
    if (type !== 'creator' && !selectedPost) {
      toast({ message: 'Select a post to analyze', type: 'info' });
      return;
    }
    setLoading(type);
    try {
      const response = type === 'pulse'
        ? await aiAPI.communityPulse({ postId: selectedPost, save: true })
        : type === 'audience'
          ? await aiAPI.audienceInsights({ postId: selectedPost, save: true })
          : await aiAPI.creatorNextMove({ save: true });
      if (type === 'pulse') setPulse(response.data.data.result);
      if (type === 'audience') setAudience(response.data.data.result);
      if (type === 'creator') setCreator(response.data.data);
      toast({ message: 'Analysis saved to your history', type: 'success' });
    } catch (error) {
      toast({ message: error.response?.data?.message || 'Analysis failed', type: 'error' });
    } finally {
      setLoading('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Activity color="var(--accent)" /> Signal Intelligence
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Understand every conversation. Discover every opportunity.</p>
      </header>

      <section className="card" style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" value={selectedPost} onChange={(event) => setSelectedPost(event.target.value)} style={{ flex: '1 1 280px' }}>
          <option value="">Choose one of your posts</option>
          {posts.map((post) => <option key={post._id} value={post._id}>{post.content.slice(0, 90)}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => run('pulse')} disabled={loading || !selectedPost}><Brain size={16} /> {loading === 'pulse' ? 'Analyzing...' : 'Community Pulse'}</button>
        <button className="btn btn-secondary" onClick={() => run('audience')} disabled={loading || !selectedPost}><Sparkles size={16} /> {loading === 'audience' ? 'Analyzing...' : 'Audience Insights'}</button>
        <button className="btn btn-secondary" onClick={() => run('creator')} disabled={loading}><BarChart3 size={16} /> {loading === 'creator' ? 'Analyzing...' : 'Creator Next Move'}</button>
      </section>

      {pulse && <div style={{ display: 'grid', gap: '1rem' }}>
        <Section title="Executive discussion summary" items={[pulse.summary]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
          <Section title="Themes" items={pulse.themes} />
          <Section title="Supportive viewpoints" items={pulse.supportiveViewpoints} />
          <Section title="Critical viewpoints" items={pulse.criticalViewpoints} />
          <Section title="Frequently asked questions" items={pulse.questions} />
          <Section title="Unanswered questions" items={pulse.unansweredQuestions} />
          <Section title="Actionable recommendations" items={pulse.suggestions} />
          <Section title="Actionable takeaways" items={pulse.takeaways} />
        </div>
        <Evidence items={pulse.evidence} comments={comments} />
        <section className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginTop: 0 }}>Discussion comments</h3>
          {comments.length ? comments.map((comment) => (
            <p id={`signal-comment-${comment._id}`} key={comment._id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', color: 'var(--text-secondary)' }}>
              <strong>{comment.author?.displayName || comment.author?.username || 'User'}:</strong> {comment.content}
            </p>
          )) : <p style={{ color: 'var(--text-muted)' }}>This post has no comments.</p>}
        </section>
      </div>}
      {audience && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
        <Section title="Qualitative audience overview" items={[audience.summary]} />
        <Section title="Appreciation points" items={audience.appreciationPoints} />
        <Section title="Recurring concerns" items={audience.concerns} />
        <Section title="Improvement suggestions" items={audience.improvements} />
      </div>}
      {creator && <div style={{ display: 'grid', gap: '1rem' }}>
        <section className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginTop: 0 }}>Calculated creator metrics</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Calculated from your stored posts, likes, comments, and hashtags only. Reach and impressions are not collected.</p>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
            <strong>{creator.stats.totalPosts} posts</strong><strong>{creator.stats.totalLikes} likes</strong><strong>{creator.stats.totalComments} comments</strong><strong>{creator.stats.engagementPerPost} engagement/post</strong>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>Frequently used hashtags: {creator.stats.frequentlyDiscussedTopics.length ? creator.stats.frequentlyDiscussedTopics.map((tag) => `#${tag}`).join(', ') : 'None recorded'}</p>
        </section>
        <Section title="Best-performing posts (stored engagement counts)" items={creator.stats.mostInteractivePosts.map((post) => `${post.postId}: ${post.likes} likes and ${post.comments} comments`)} />
        <Section title="Creator next moves (AI-generated)" items={[...(creator.result.suggestions || []), ...(creator.result.postIdeas || [])]} />
        <Section title="How recommendations relate to activity" items={creator.result.followUps || []} />
      </div>}
      {!pulse && !audience && !creator && <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><Save size={28} /><p>Run an analysis to create a saved, evidence-based insight.</p></div>}
    </div>
  );
}
