import { useState } from 'react';
import { aiAPI } from '../../api';
import { useToast } from '../../contexts/ToastContext';
import { Bot, Sparkles, FileText, MessageCircle, Copy, Check } from 'lucide-react';

export default function AIStudio() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('studio'); // 'studio' | 'summarize' | 'reply'
  
  // Content Studio state
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('engaging');
  const [currentContent, setCurrentContent] = useState('');
  const [studioResult, setStudioResult] = useState('');
  const [loadingStudio, setLoadingStudio] = useState(false);

  // Discussion Intelligence state
  const [discussionText, setDiscussionText] = useState('');
  const [summaryResult, setSummaryResult] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Smart Reply state
  const [postContext, setPostContext] = useState('');
  const [replyTone, setReplyTone] = useState('friendly');
  const [replyResult, setReplyResult] = useState([]);
  const [loadingReply, setLoadingReply] = useState(false);

  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ message: 'Copied to clipboard!', type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGeneratePost = async () => {
    if (!topic.trim()) {
      toast({ message: 'Please provide a topic or prompt', type: 'info' });
      return;
    }
    setLoadingStudio(true);
    try {
      const res = await aiAPI.contentStudio({
        mode: 'generate',
        topic,
        tone
      });
      setStudioResult(res.data.data.result);
      toast({ message: 'Post generated successfully!', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Generation failed', type: 'error' });
    } finally {
      setLoadingStudio(false);
    }
  };

  const handleImprovePost = async () => {
    if (!currentContent.trim()) {
      toast({ message: 'Please provide text to rewrite or improve', type: 'info' });
      return;
    }
    setLoadingStudio(true);
    try {
      const res = await aiAPI.contentStudio({
        mode: 'improve',
        currentContent,
        tone
      });
      setStudioResult(res.data.data.result);
      toast({ message: 'Post refined successfully!', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Refinement failed', type: 'error' });
    } finally {
      setLoadingStudio(false);
    }
  };

  const handleSummarize = async () => {
    if (!discussionText.trim()) {
      toast({ message: 'Please provide discussion or thread text to summarize', type: 'info' });
      return;
    }
    setLoadingSummary(true);
    try {
      const res = await aiAPI.summarize({ text: discussionText });
      setSummaryResult(res.data.data.summary);
      toast({ message: 'Discussion summarized!', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Summarization failed', type: 'error' });
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSuggestReply = async () => {
    if (!postContext.trim()) {
      toast({ message: 'Please provide the post or comment to reply to', type: 'info' });
      return;
    }
    setLoadingReply(true);
    try {
      const res = await aiAPI.suggestReply({ postContext, tone: replyTone });
      const replies = res.data.data.replies || [res.data.data.reply];
      setReplyResult(replies);
      toast({ message: 'Replies generated!', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Reply suggestion failed', type: 'error' });
    } finally {
      setLoadingReply(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={28} color="var(--accent)" /> AI Assistant Hub
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
          Smart capabilities powered by Google Gemini to elevate your creative writing, summarize threads, and draft thoughtful replies.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'studio' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('studio')}
          style={{ gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <Sparkles size={16} /> Content Studio
        </button>
        <button
          className={`btn ${activeTab === 'summarize' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('summarize')}
          style={{ gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <FileText size={16} /> Discussion Intelligence
        </button>
        <button
          className={`btn ${activeTab === 'reply' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('reply')}
          style={{ gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <MessageCircle size={16} /> Smart Reply Assistant
        </button>
      </div>

      {/* Content Studio Tab */}
      {activeTab === 'studio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Draft or Refine Posts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Desired Tone</label>
                <select
                  className="input"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="engaging">Engaging & Conversational</option>
                  <option value="professional">Professional & Analytical</option>
                  <option value="inspirational">Inspirational & Visionary</option>
                  <option value="concise">Concise & Punchy</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Generate from Topic or Idea</label>
                <input
                  className="input"
                  placeholder="e.g. Why decentralization matters for modern web applications..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleGeneratePost}
                  disabled={loadingStudio || !topic.trim()}
                  style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
                >
                  {loadingStudio ? 'Crafting post...' : 'Generate New Post'}
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <label className="form-label">Or Rewrite / Enhance Existing Content</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Paste rough draft here to improve readability, grammar and punchiness..."
                  value={currentContent}
                  onChange={(e) => setCurrentContent(e.target.value)}
                  style={{ resize: 'none', width: '100%', marginBottom: '0.5rem' }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleImprovePost}
                  disabled={loadingStudio || !currentContent.trim()}
                >
                  {loadingStudio ? 'Refining...' : 'Enhance & Polish Draft'}
                </button>
              </div>
            </div>
          </div>

          {studioResult && (
            <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={16} /> Generated Post
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => copyToClipboard(studioResult)}
                  style={{ fontSize: '0.8rem', gap: '0.35rem' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Text'}
                </button>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.95rem' }}>{studioResult}</p>
            </div>
          )}
        </div>
      )}

      {/* Discussion Intelligence Tab */}
      {activeTab === 'summarize' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Discussion Intelligence</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Paste lengthy comment threads or long technical discussions to pull key decisions, consensus, and takeaways.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea
              className="input"
              rows={6}
              placeholder="Paste comments or discussion log here..."
              value={discussionText}
              onChange={(e) => setDiscussionText(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSummarize}
              disabled={loadingSummary || !discussionText.trim()}
              style={{ alignSelf: 'flex-start' }}
            >
              {loadingSummary ? 'Analyzing discussion...' : 'Summarize Discussion'}
            </button>

            {summaryResult && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '1.25rem',
                marginTop: '1rem'
              }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent)' }}>Summary & Key Points</h4>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.9rem' }}>{summaryResult}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Reply Tab */}
      {activeTab === 'reply' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Smart Reply Assistant</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Generate thoughtful, context-aware suggestions to reply to someone's post or comment. You can review and edit before posting.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Post or comment you want to reply to</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Paste the post or comment text here..."
                value={postContext}
                onChange={(e) => setPostContext(e.target.value)}
                style={{ width: '100%', resize: 'none' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reply Tone</label>
              <select
                className="input"
                value={replyTone}
                onChange={(e) => setReplyTone(e.target.value)}
              >
                <option value="friendly">Friendly & Encouraging</option>
                <option value="constructive">Constructive & Analytical</option>
                <option value="inquisitive">Curious & Asking Follow-up</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSuggestReply}
              disabled={loadingReply || !postContext.trim()}
              style={{ alignSelf: 'flex-start' }}
            >
              {loadingReply ? 'Generating replies...' : 'Suggest Replies'}
            </button>

            {replyResult.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="form-label">Suggested Options (Click to copy):</label>
                {replyResult.map((rep, idx) => (
                  <div
                    key={idx}
                    onClick={() => copyToClipboard(rep)}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      padding: '0.85rem 1rem',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{rep}</span>
                    <Copy size={16} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

