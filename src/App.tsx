/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Settings } from './components/Settings';
import { ImageUploader } from './components/ImageUploader';
import { PromptConfig } from './components/PromptConfig';
import { ResultTable } from './components/ResultTable';
import { History } from './components/History';
import { ErrorDisplay } from './components/ErrorDisplay';
import { Button } from './components/ui-elements';
import { Settings as SettingsIcon, History as HistoryIcon, Play, Github, Sun, Moon } from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { LLMService } from './services/llm';
import { StorageService, type TranscribedItem } from './services/storage';
import type { GBIFOccurrence } from './services/gbif';

function App() {
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Error State
  const [errorState, setErrorState] = useState<{
    error: Error | null;
    context: { provider: string; model: string; stage: 'transcription' | 'standardization'; prompt: string; rawError: any; gbifData?: GBIFOccurrence } | null;
  }>({ error: null, context: null });

  // Workflow State
  // Workflow State
  const [image, setImage] = useState<string>('');

  // NOTE: Initial state must come from localStorage immediately if possible, or use useEffect to hydrate
  // But useState initializer is better.
  const stored = StorageService.getRecentState();

  const [prompt1, setPrompt1] = useState(stored?.prompt1 || "You are an experienced biologist specializing in describing herbarium specimens. You have a keen eye for detail and can describe specimens very accurately. Your task is to extract all information from the provided image of a herbarium specimen and create a short description containing all information from the image. Do not provide information on higher taxonomy beyond kingdom. Perform a literal transcription of all text visible on the specimen's label. The text on the label is handwritten.");
  const [provider1, setProvider1] = useState(stored?.provider1 || 'openai');
  const [model1, setModel1] = useState(stored?.model1 || 'gpt-4o');

  const [prompt2, setPrompt2] = useState(stored?.prompt2 || "Standardize the provided information about a preserved specimen into a JSON object using exclusively valid Darwin Core terms. The JSON structure should follow: { \"dwc:scientificName\": \"Value\", \"dwc:locality\": \"Value\", ... }.");
  const [provider2, setProvider2] = useState(stored?.provider2 || 'openai');
  const [model2, setModel2] = useState(stored?.model2 || 'gpt-4o');

  const [temp1, setTemp1] = useState(stored?.temp1 ?? 0);
  const [temp2, setTemp2] = useState(stored?.temp2 ?? 0);

  const [result1, setResult1] = useState('');
  const [result2, setResult2] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(0); // 1 = transcribing, 2 = standardizing
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [gbifData, setGbifData] = useState<GBIFOccurrence | null>(null);

  // Auto-save session
  useEffect(() => {
    StorageService.saveRecentState({
      prompt1, provider1, model1, temp1,
      prompt2, provider2, model2, temp2
    });
  }, [prompt1, provider1, model1, temp1, prompt2, provider2, model2, temp2]);

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

    let currentPhase: 'transcription' | 'standardization' = 'transcription';

    try {
      // Step 1
      setStep(1);
      currentPhase = 'transcription';
      const provider1Inst = LLMService.getProvider(provider1);
      // Fallback model if empty
      const m1 = model1 || (provider1 === 'openai' ? 'gpt-4o' : provider1 === 'gemini' ? 'gemini-1.5-flash' : provider1 === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'grok-vision-beta');

      const r1 = await provider1Inst.generateTranscription(p1Key, m1, image, prompt1, settings.proxyUrl, { temperature: temp1 });
      setResult1(r1);

      // Step 2
      setStep(2);
      currentPhase = 'standardization';
      const provider2Inst = LLMService.getProvider(provider2);
      const m2 = model2 || (provider2 === 'openai' ? 'gpt-4o' : provider2 === 'gemini' ? 'gemini-1.5-flash' : provider2 === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'grok-vision-beta');

      const r2 = await provider2Inst.standardizeText((settings as any)[`${provider2}Key`] || p1Key, m2, r1, prompt2, settings.proxyUrl, { temperature: temp2 });
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
        temp1,
        provider2: `${provider2}/${m2}`,
        temp2,
      };
      StorageService.addToHistory(item);
      setHistoryTrigger(prev => prev + 1);

    } catch (e: any) {
      console.error(e);
      // Determine context based on local variable phase
      const isStep1 = currentPhase === 'transcription';
      const provider = isStep1 ? provider1 : provider2;
      const model = isStep1 ? (model1 || 'gpt-4o') : (model2 || 'gpt-4o');
      const stage = currentPhase;

      setErrorState({
        error: e instanceof Error ? e : new Error(String(e)),
        context: {
          provider,
          model,
          stage,
          prompt: isStep1 ? prompt1 : prompt2,
          rawError: e, // Pass the raw object for inspection
          gbifData: gbifData || undefined
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
    if (item.temp1 !== undefined) setTemp1(item.temp1);
    if (item.temp2 !== undefined) setTemp2(item.temp2);

    // Restore Model Selection
    if (item.provider1) {
      const [p, m] = item.provider1.split('/');
      setProvider1(p);
      setModel1(m);
    }
    if (item.provider2) {
      const [p, m] = item.provider2.split('/');
      setProvider2(p);
      setModel2(m);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 transition-colors duration-300">

      {/* Header */}
      <header className="fixed top-0 w-full border-b border-border bg-background/80 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
              S
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground-muted">
              SpLATform <span className="text-xs font-normal text-foreground-muted ml-2 tracking-widest uppercase">Web Edition</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-9 w-9 p-0" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
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
      <main className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] pt-16">

        {/* Left Column: Fixed Specimen Image */}
        <aside className="lg:w-1/2 lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] p-6 bg-surface/20 border-r border-border overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider pl-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
              Specimen Image
            </h2>
          </div>
          <ImageUploader
            onImageReady={setImage}
            onGBIFData={setGbifData}
            className="flex-1 shadow-inner"
          />
        </aside>

        {/* Right Column: Scrollable Config & Results */}
        <section className="lg:w-1/2 flex flex-col">

          {/* Sub Navigation Bar */}
          <nav className="sticky top-16 z-40 bg-background/95 backdrop-blur-md border-b border-border px-6 py-2 flex items-center gap-4 justify-center sm:justify-start">
            <a href="#config" className="text-xs font-bold uppercase tracking-widest text-foreground-muted hover:text-primary transition-colors px-2 py-1 rounded">Pipeline</a>
            <div className="w-px h-3 bg-border"></div>
            <a href="#results" className="text-xs font-bold uppercase tracking-widest text-foreground-muted hover:text-primary transition-colors px-2 py-1 rounded">Results</a>
            <div className="flex-1"></div>
            <div className="hidden sm:flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-2 animate-pulse text-[10px] font-bold uppercase tracking-tighter text-info">
                  <div className="w-1.5 h-1.5 rounded-full bg-info"></div>
                  {step === 1 ? 'Transcribing...' : 'Standardizing...'}
                </div>
              )}
            </div>
          </nav>

          {/* Scrollable Content Container */}
          <div className="p-6 space-y-12">

            {/* Step 2: Pipeline Configuration */}
            <div id="config" className="scroll-mt-32 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider pl-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">2</span>
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
                  temperature={temp1}
                  setTemperature={setTemp1}
                />
                <PromptConfig
                  step={2}
                  prompt={prompt2}
                  setPrompt={setPrompt2}
                  selectedModel={model2}
                  setSelectedModel={setModel2}
                  selectedProvider={provider2}
                  setSelectedProvider={setProvider2}
                  temperature={temp2}
                  setTemperature={setTemp2}
                />
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                <Button
                  className="relative w-full text-lg py-6 bg-surface border border-border hover:bg-surface-hover transition-all font-semibold tracking-wide"
                  onClick={handleRun}
                  disabled={isLoading || !image}
                  isLoading={isLoading}
                >
                  {!isLoading && <Play size={20} className="mr-3 fill-primary text-primary" />}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {isLoading ? (step === 1 ? "Transcribing Image..." : "Standardizing Text...") : "Execute Pipeline"}
                  </span>
                </Button>
              </div>
            </div>

            {/* Step 3: Results */}
            <div id="results" className="scroll-mt-32 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider pl-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</span>
                  Extraction Results
                </h2>
              </div>
              <ResultTable
                step1Result={result1}
                step2Result={result2}
                isLoading={isLoading}
                currentStep={step}
                gbifData={gbifData || undefined}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Modals/Sidebars */}
      <ErrorDisplay
        error={errorState.error}
        context={errorState.context}
        onClose={() => setErrorState({ error: null, context: null })}
      />

      {showSettings && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl">
            <Settings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-80 bg-background border-l border-border z-50 shadow-2xl transform transition-transform duration-300">
          <div className="h-full overflow-y-auto">
            <div className="p-4 flex justify-between items-center border-b border-border">
              <h2 className="font-bold">Run History</h2>
              <button onClick={() => setShowHistory(false)} className="text-foreground-muted hover:text-foreground"><SettingsIcon className="rotate-45" size={20} /></button>
            </div>
            <History onLoadItem={(item) => { loadHistoryItem(item); setShowHistory(false); }} refreshTrigger={historyTrigger} />
          </div>
        </div>
      )}

    </div>
  )
}

export default App
