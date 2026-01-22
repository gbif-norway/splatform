/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Settings } from './components/Settings';
import { ImageUploader } from './components/ImageUploader';
import { PromptConfig } from './components/PromptConfig';
import { ResultTable } from './components/ResultTable';
import { History } from './components/History';
import { ErrorDisplay } from './components/ErrorDisplay';
import { Button } from './components/ui-elements';
import { Settings as SettingsIcon, History as HistoryIcon, Play, Github } from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { LLMService } from './services/llm';
import { StorageService, type TranscribedItem } from './services/storage';

function App() {
  const { settings } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Error State
  const [errorState, setErrorState] = useState<{
    error: Error | null;
    context: { provider: string; model: string; stage: 'transcription' | 'standardization'; prompt: string; rawError: any } | null;
  }>({ error: null, context: null });

  // Workflow State
  const [image, setImage] = useState<string>('');

  const [prompt1, setPrompt1] = useState("You are an experienced biologist specializing in describing herbarium specimens. You have a keen eye for detail and can describe specimens very accurately. Your task is to extract all information from the provided image of a herbarium specimen and create a short description containing all information from the image. Do not provide information on higher taxonomy beyond kingdom. Perform a literal transcription of all text visible on the specimen's label. The text on the label is handwritten.");
  const [provider1, setProvider1] = useState('openai');
  const [model1, setModel1] = useState('gpt-4o');

  const [prompt2, setPrompt2] = useState("Standardize the provided information about a preserved specimen into a JSON object using exclusively valid Darwin Core terms. The JSON structure should follow: { \"dwc:scientificName\": \"Value\", \"dwc:locality\": \"Value\", ... }.");
  const [provider2, setProvider2] = useState('openai');
  const [model2, setModel2] = useState('gpt-4o');

  const [result1, setResult1] = useState('');
  const [result2, setResult2] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(0); // 1 = transcribing, 2 = standardizing
  const [historyTrigger, setHistoryTrigger] = useState(0);

  const handleRun = async () => {
    if (!image) {
      alert("Please upload an image first.");
      return;
    }

    // Check keys
    const p1Key = (settings as any)[`${provider1}Key`];
    if (!p1Key) {
      setShowSettings(true);
      alert(`Missing API Key for ${provider1}`);
      return;
    }
    const p2Key = (settings as any)[`${provider2}Key`];
    if (!p2Key && provider1 !== provider2) {
      setShowSettings(true);
      alert(`Missing API Key for ${provider2}`);
      return;
    }

    setIsLoading(true);
    setResult1('');
    setResult2('');

    try {
      // Step 1
      setStep(1);
      const provider1Inst = LLMService.getProvider(provider1);
      // Fallback model if empty
      const m1 = model1 || (provider1 === 'openai' ? 'gpt-4o' : provider1 === 'gemini' ? 'gemini-1.5-flash' : provider1 === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'grok-vision-beta');

      const r1 = await provider1Inst.generateTranscription(p1Key, m1, image, prompt1, settings.proxyUrl);
      setResult1(r1);

      // Step 2
      setStep(2);
      const provider2Inst = LLMService.getProvider(provider2);
      const m2 = model2 || (provider2 === 'openai' ? 'gpt-4o' : provider2 === 'gemini' ? 'gemini-1.5-flash' : provider2 === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'grok-vision-beta');

      const r2 = await provider2Inst.standardizeText((settings as any)[`${provider2}Key`] || p1Key, m2, r1, prompt2, settings.proxyUrl);
      setResult2(r2);

      // Save History
      const item: TranscribedItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        filename: "Image Upload",
        prompt1,
        result1: r1,
        prompt2,
        result2: r2,
        provider1: `${provider1}/${m1}`,
        provider2: `${provider2}/${m2}`,
      };
      StorageService.addToHistory(item);
      setHistoryTrigger(prev => prev + 1);

    } catch (e: any) {
      console.error(e);
      // Determine context based on current step
      const isStep1 = step === 1;
      const provider = isStep1 ? provider1 : provider2;
      const model = isStep1 ? (model1 || 'gpt-4o') : (model2 || 'gpt-4o');
      const stage = isStep1 ? 'transcription' : 'standardization';

      setErrorState({
        error: e instanceof Error ? e : new Error(String(e)),
        context: {
          provider,
          model,
          stage,
          prompt: isStep1 ? prompt1 : prompt2,
          rawError: e // Pass the raw object for inspection
        }
      });
    } finally {
      setIsLoading(false);
      setStep(0);
    }
  };

  const loadHistoryItem = (item: TranscribedItem) => {
    setPrompt1(item.prompt1);
    setPrompt2(item.prompt2);
    setResult1(item.result1);
    setResult2(item.result2);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black text-slate-200 font-sans selection:bg-blue-500/30">

      {/* Header */}
      <header className="fixed top-0 w-full border-b border-white/5 bg-slate-950/50 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              S
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-100 to-slate-300">
              Splatform <span className="text-xs font-normal text-slate-500 ml-2 tracking-widest uppercase">Web Edition</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden sm:flex" onClick={() => window.open('https://github.com/gbif-norway/splatform', '_blank')}>
              <Github size={18} className="mr-2" /> GitHub
            </Button>
            <Button variant="ghost" onClick={() => setShowHistory(!showHistory)}>
              <HistoryIcon size={18} className="mr-2" /> History
            </Button>
            <Button variant="secondary" onClick={() => setShowSettings(!showSettings)}>
              <SettingsIcon size={18} className="mr-2" /> Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-24 pb-12 flex flex-col gap-8 max-w-[1600px]">

        {/* Top Section: Upload & Config (Grid Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column: Image (6 cols) */}
          <div className="lg:col-span-6 space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                Input Image
              </h2>
            </div>
            <ImageUploader onImageReady={setImage} className="flex-1 min-h-[600px]" />
          </div>

          {/* Right Column: Config & Action (6 cols) */}
          <div className="lg:col-span-6 flex flex-col space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span>
                Pipeline Configuration
              </h2>
            </div>

            <div className="flex flex-col gap-6">
              <PromptConfig
                step={1}
                prompt={prompt1}
                setPrompt={setPrompt1}
                selectedModel={model1}
                setSelectedModel={setModel1}
                selectedProvider={provider1}
                setSelectedProvider={setProvider1}
              />
              <PromptConfig
                step={2}
                prompt={prompt2}
                setPrompt={setPrompt2}
                selectedModel={model2}
                setSelectedModel={setModel2}
                selectedProvider={provider2}
                setSelectedProvider={setProvider2}
              />
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <Button
                className="relative w-full text-lg py-6 bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-all font-semibold tracking-wide"
                onClick={handleRun}
                disabled={isLoading || !image}
                isLoading={isLoading}
              >
                {!isLoading && <Play size={20} className="mr-3 fill-blue-500 text-blue-500" />}
                <span className="bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">
                  {isLoading ? (step === 1 ? "Transcribing Image..." : "Standardizing Text...") : "Execute Pipeline"}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="w-full space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">3</span>
            Results
          </h2>
          <ResultTable
            step1Result={result1}
            step2Result={result2}
            isLoading={isLoading}
            currentStep={step}
          />
        </div>

      </main>

      {/* Modals/Sidebars */}
      <ErrorDisplay
        error={errorState.error}
        context={errorState.context}
        onClose={() => setErrorState({ error: null, context: null })}
      />

      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl">
            <Settings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-80 bg-slate-950 border-l border-white/10 z-50 shadow-2xl transform transition-transform duration-300">
          <div className="h-full overflow-y-auto">
            <div className="p-4 flex justify-between items-center border-b border-white/5">
              <h2 className="font-bold">Run History</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-500"><SettingsIcon className="rotate-45" size={20} /></button>
            </div>
            <History onLoadItem={(item) => { loadHistoryItem(item); setShowHistory(false); }} refreshTrigger={historyTrigger} />
          </div>
        </div>
      )}

    </div>
  )
}

export default App
