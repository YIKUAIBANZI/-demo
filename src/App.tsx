import React, { useState } from 'react';
import { Search, Database, MessageSquare, Crosshair, Target, CheckCircle, Loader2, FileText, ChevronDown, Bot, Lightbulb } from 'lucide-react';
import { runAgent, runSynthesis, runOrchestrator, AgentRole } from './lib/agents';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type AgentState = 'idle' | 'running' | 'done' | 'error';

interface AgentData {
  id: AgentRole;
  name: string;
  icon: React.ElementType;
  state: AgentState;
  log: string;
  error?: string;
}

const INITIAL_AGENTS: AgentData[] = [
  { id: 'search', name: 'Search Agent', icon: Search, state: 'idle', log: '' },
  { id: 'scraper', name: 'Scraper Agent', icon: Database, state: 'idle', log: '' },
  { id: 'review', name: 'Review Agent', icon: MessageSquare, state: 'idle', log: '' },
  { id: 'positioning', name: 'Positioning Agent', icon: Crosshair, state: 'idle', log: '' },
];

export default function App() {
  // Orchestrator State
  const [idea, setIdea] = useState('');
  const [orchestratorState, setOrchestratorState] = useState<AgentState>('idle');
  const [orchestratorFeedback, setOrchestratorFeedback] = useState('');

  // Agent Params State
  const [target, setTarget] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [dimensions, setDimensions] = useState('');
  
  // Pipeline State
  const [agents, setAgents] = useState<AgentData[]>(INITIAL_AGENTS);
  const [synthesisState, setSynthesisState] = useState<AgentState>('idle');
  const [synthesisLog, setSynthesisLog] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const updateAgent = (id: AgentRole, updater: Partial<AgentData>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updater } : a));
  };

  const handleAnalyzeIdea = async () => {
    if (!idea.trim()) return;
    setOrchestratorState('running');
    setOrchestratorFeedback('Analyzing your concept and mapping the landscape...');
    
    try {
      const result = await runOrchestrator(idea);
      setTarget(result.target || '');
      setCompetitors(result.competitors || '');
      setDimensions(result.dimensions || '');
      setOrchestratorFeedback(result.feedback || 'Analysis complete. Ready to dispatch research agents.');
      setOrchestratorState('done');
    } catch (error: any) {
      console.error(error);
      setOrchestratorFeedback('Failed to process idea automatically. You can manually fill the fields below.');
      setOrchestratorState('error');
    }
  };

  const handleStart = async () => {
    if (!target) return;
    setIsRunning(true);
    setAgents(INITIAL_AGENTS);
    setSynthesisState('idle');
    setSynthesisLog('');

    const results: Record<AgentRole, string> = {
      search: '', scraper: '', review: '', positioning: ''
    };

    // Run parallel agents
    const runPromises = INITIAL_AGENTS.map(async (agentDef) => {
      updateAgent(agentDef.id, { state: 'running', log: 'Dispatching...' });
      try {
        const text = await runAgent(
          agentDef.id,
          target,
          competitors,
          dimensions,
          (logChunk) => {
            updateAgent(agentDef.id, { log: logChunk });
          }
        );
        results[agentDef.id] = text;
        updateAgent(agentDef.id, { state: 'done' });
      } catch (e: any) {
        updateAgent(agentDef.id, { state: 'error', error: e.message || 'Error occurred' });
      }
    });

    await Promise.all(runPromises);

    // Synthesis step
    setSynthesisState('running');
    try {
      await runSynthesis(target, results, (logChunk) => {
        setSynthesisLog(logChunk);
      });
      setSynthesisState('done');
    } catch (e: any) {
      setSynthesisState('error');
      setSynthesisLog(e.message || 'Synthesis failed');
    }

    setIsRunning(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-8">
      {/* HEADER */}
      <header className="border-b border-black pb-4 mb-2">
        <h1 className="text-3xl font-[Georgia] italic uppercase tracking-wider opacity-90 flex items-center gap-3">
          <Target className="w-8 h-8 text-blue-600" />
          AutoCompete AI
        </h1>
        <p className="text-sm opacity-60 font-mono mt-2">DIGITAL RESEARCH ORCHESTRATOR [v2.0.0]</p>
      </header>

      {/* ORCHESTRATOR STEP 1 */}
      <div className="agent-card p-6 border-l-4 border-l-blue-600">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold uppercase tracking-widest text-blue-900">1. Orchestrator: Idea Analysis</h2>
        </div>
        <p className="text-sm opacity-70 mb-4 font-mono">Input your product idea, target, or paste a document. The Orchestrator will analyze it, infer competitors, and ask clarifying questions.</p>
        <textarea
          value={idea}
          onChange={e => setIdea(e.target.value)}
          disabled={orchestratorState === 'running' || isRunning}
          className="w-full h-28 p-4 bg-transparent border border-black/20 outline-none font-mono text-sm focus:border-blue-600 transition-colors resize-none mb-4"
          placeholder="e.g. I want to build an AI digital pet app where users take a photo of their real pet and generate a video pet avatar to interact with..."
        />
        <div className="flex justify-between items-start flex-col md:flex-row gap-4">
            <button
              onClick={handleAnalyzeIdea}
              disabled={!idea.trim() || orchestratorState === 'running' || isRunning}
              className="bg-black text-white px-6 py-2 uppercase tracking-widest text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {orchestratorState === 'running' ? <Loader2 className="animate-spin w-4 h-4" /> : <Lightbulb className="w-4 h-4 text-yellow-300" />}
              {orchestratorState === 'running' ? 'Analyzing...' : 'Analyze Idea'}
            </button>
            
            {orchestratorFeedback && (
               <div className="flex-1 bg-blue-50/70 p-4 border border-blue-200 text-sm font-sans text-blue-900 rounded-sm leading-relaxed">
                 <strong className="block mb-1 font-mono uppercase text-xs tracking-wider opacity-60">AI Feedback & Clarification:</strong>
                 <div className="prose prose-sm max-w-none text-blue-900">
                    <Markdown>{orchestratorFeedback}</Markdown>
                 </div>
               </div>
            )}
        </div>
      </div>

      {/* INPUT FORM STEP 2 */}
      <div className="agent-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest opacity-80 mb-6 border-b border-black/10 pb-2">2. Refine Parameters & Launch</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="flex flex-col gap-2">
            <span className="tech-header">Target Product Concept</span>
            <input 
              type="text" 
              value={target}
              onChange={e => setTarget(e.target.value)}
              disabled={isRunning}
              className="p-2 bg-transparent border-b border-black outline-none font-mono focus:border-blue-600 transition-colors text-sm"
              placeholder="e.g. AI Digital Pet App"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="tech-header">Competitors</span>
            <input 
              type="text" 
              value={competitors}
              onChange={e => setCompetitors(e.target.value)}
              disabled={isRunning}
              className="p-2 bg-transparent border-b border-black outline-none font-mono focus:border-blue-600 transition-colors text-sm"
              placeholder="e.g. Peridot, Pocket Frogs"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="tech-header">Dimensions</span>
            <input 
              type="text" 
              value={dimensions}
              onChange={e => setDimensions(e.target.value)}
              disabled={isRunning}
              className="p-2 bg-transparent border-b border-black outline-none font-mono focus:border-blue-600 transition-colors text-sm"
              placeholder="e.g. Pricing, Realism, Features"
            />
          </label>
          <div className="md:col-span-3 flex justify-end mt-4">
            <button 
              onClick={handleStart}
              disabled={isRunning || !target.trim()}
              className="bg-blue-600 text-white px-6 py-3 uppercase tracking-widest text-sm font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRunning ? <Loader2 className="animate-spin w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isRunning ? 'Orchestrating Agents...' : 'Dispatch Research Agents'}
            </button>
          </div>
        </div>
      </div>

      {/* AGENTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(agent => (
          <div key={agent.id} className={`agent-card p-4 h-72 flex flex-col ${agent.state === 'running' ? 'running' : ''} ${agent.state === 'done' ? 'done' : ''}`}>
            <div className="flex items-center justify-between border-b border-black/10 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <agent.icon className="w-5 h-5 text-gray-700" />
                <span className="font-semibold uppercase tracking-wider text-sm">{agent.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {agent.state === 'running' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                {agent.state === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
                <span className="tech-header text-[10px]">{agent.state}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto w-full text-[11px] tech-value whitespace-pre-wrap opacity-80 break-words pr-2 overflow-x-hidden flex flex-col justify-end">
              {agent.log || (agent.state === 'idle' ? 'Awaiting dispatch...' : '')}
              {agent.error && <span className="text-red-500 block mt-2">Error: {agent.error}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* SYNTHESIS / FINAL REPORT */}
      {(synthesisState !== 'idle') && (
        <div className={`agent-card p-8 mt-8 mb-24 min-h-[400px] ${synthesisState === 'running' ? 'running' : 'done'}`}>
          <div className="flex items-center gap-3 border-b border-black/20 pb-4 mb-8">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-semibold uppercase tracking-widest">Synthesis Report</h2>
            {synthesisState === 'running' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
            {synthesisState === 'done' && <CheckCircle className="w-5 h-5 text-green-500" />}
          </div>
          
          <div className="prose prose-sm max-w-none md:prose-base prose-slate">
            {synthesisState === 'running' && !synthesisLog && (
              <p className="tech-value opacity-50">Summarizing and formatting final insights...</p>
            )}
            {synthesisLog && (
              <Markdown remarkPlugins={[remarkGfm]}>{synthesisLog}</Markdown>
            )}
            {synthesisState === 'error' && (
              <div className="text-red-500 tech-value">{synthesisLog}</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
