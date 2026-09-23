import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './App.css';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

interface Message {
  role: 'user' | 'bot' | 'system';
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Hi! I am the virtual assistant. How can I help with your network connection today?' }
  ]);
  const [input, setInput] = useState('');
  const [isEscalated, setIsEscalated] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Agent Assist State
  const [summary, setSummary] = useState('');
  const [suggestedReply, setSuggestedReply] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isEscalated) return;
    
    const newMessages: Message[] = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const userMessageCount = newMessages.filter(m => m.role === 'user').length;

    if (userMessageCount >= 3) {
      // Trigger Strict Escalation Rule
      setMessages(prev => [...prev, { role: 'system', content: 'Escalating to human agent...' }]);
      setIsEscalated(true);
      await generateAgentAssist(newMessages);
    } else {
      // Standard L1 Bot Response
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are a Level 1 Telco Tech Support bot. The customer says: "${input}". Provide a brief, single-paragraph troubleshooting step for fiber internet issues.`;
        const result = await model.generateContent(prompt);
        setMessages(prev => [...prev, { role: 'bot', content: result.response.text() }]);
      } catch (error) {
        setMessages(prev => [...prev, { role: 'bot', content: 'API Error: Please check your API key.' }]);
      }
    }
    setLoading(false);
  };

  const generateAgentAssist = async (chatHistory: Message[]) => {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const chatText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
      
      // Prompt 1: Generate Summary
      const summaryResult = await model.generateContent(`Summarize this customer support chat in exactly 2 short sentences focusing on the technical issue:\n${chatText}`);
      setSummary(summaryResult.response.text());

      // Prompt 2: Generate Suggested Reply
      const replyResult = await model.generateContent(`Based on this chat, draft a polite 2-sentence response for a human agent to send to the customer. Acknowledge the issue and state that line diagnostics are starting:\n${chatText}`);
      setSuggestedReply(replyResult.response.text());
    } catch (error) {
      console.error("Failed to generate agent assist data");
    }
  };

  return (
    <div className="flex h-screen w-full font-sans text-slate-800">
      
      {/* Left Screen: Customer View */}
      <div className="w-1/2 bg-white flex flex-col border-r border-slate-200">
        <div className="p-4 bg-blue-600 text-white font-bold text-lg shadow-sm">
          Virtual Support Agent
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                msg.role === 'system' ? 'bg-amber-100 text-amber-800 w-full text-center font-medium' : 
                'bg-white border border-slate-200 shadow-sm rounded-bl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && !isEscalated && <div className="text-sm text-slate-400">Bot is typing...</div>}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isEscalated}
            placeholder={isEscalated ? "Chat closed. Agent connecting..." : "Type your issue here (e.g. Red LOS light)"}
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
          />
          <button 
            onClick={handleSend} 
            disabled={isEscalated || !input.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Right Screen: Agent View */}
      <div className="w-1/2 bg-slate-900 text-slate-100 flex flex-col relative">
        {!isEscalated ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
            <p className="text-slate-400 text-lg font-medium flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              Waiting for ticket escalation...
            </p>
          </div>
        ) : null}

        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-lg text-emerald-400">CX Workspace // Live Handoff</h2>
          <span className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/20">PRIORITY</span>
        </div>

        <div className="flex-1 p-8 space-y-8 overflow-y-auto">
          {/* Summary Card */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">AI Handoff Summary</h3>
            {summary ? (
              <p className="text-slate-200 leading-relaxed">{summary}</p>
            ) : (
              <p className="text-slate-500 animate-pulse">Generating context summary...</p>
            )}
          </div>

          {/* Suggested Reply Card */}
          <div className="bg-slate-800 p-6 rounded-xl border border-blue-500/30 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <h3 className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-3 flex justify-between">
              Suggested Reply
              <button className="text-slate-300 hover:text-white transition-colors">Copy</button>
            </h3>
            {suggestedReply ? (
              <div className="bg-slate-900/50 p-4 rounded-lg text-slate-300 border border-slate-700/50">
                {suggestedReply}
              </div>
            ) : (
              <p className="text-slate-500 animate-pulse">Drafting response...</p>
            )}
          </div>

          {/* Next Best Action */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">Next Best Action</h3>
            <div className="flex gap-4">
              <button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-semibold transition-colors shadow-lg shadow-emerald-900/20">
                Run Line Diagnostics
              </button>
              <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 rounded-lg font-semibold transition-colors border border-slate-600">
                Create Tech Support Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}