import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/views/Dashboard";
import { GrainReceiptForm } from "./components/views/GrainReceiptForm";
import { AccessibilitySettings } from "./components/views/AccessibilitySettings";
import { VoiceAssistantPanel } from "./components/voice/VoiceAssistantPanel";
import { FormProvider } from "./store/FormContext";
import { UltravoxProvider } from "./ultravox/UltravoxProvider";

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'form' | 'settings'>('dashboard');

  return (
    <FormProvider>
      <UltravoxProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans selection:bg-gov-blue/20 selection:text-gov-blue">
          {/* Persistent Sidebar */}
          <Sidebar currentView={currentView} onViewChange={setCurrentView} />

          {/* Main Content Area */}
          <main className="flex-1 ml-80 h-full relative">
            {/* Background Ambient Glows */}
            <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-gov-blue/5 rounded-full blur-[120px] pointer-events-none -z-10" />
            <div className="fixed bottom-0 left-80 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

            <AnimatePresence mode="wait">
              {currentView === 'dashboard' && (
                <Dashboard key="dashboard" onResume={() => setCurrentView('form')} />
              )}
              {currentView === 'form' && (
                <GrainReceiptForm key="form" />
              )}
              {currentView === 'settings' && (
                <AccessibilitySettings key="settings" />
              )}
            </AnimatePresence>
          </main>

          {/* Voice Assistant - only show on form view */}
          {currentView === 'form' && <VoiceAssistantPanel />}
        </div>
      </UltravoxProvider>
    </FormProvider>
  );
}

export default App;
