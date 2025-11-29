import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "../ui/GlassCard";
import { Eye, Type, Volume2, Palette, Zap, Monitor } from "lucide-react";

export const AccessibilitySettings = () => {
  const [settings, setSettings] = useState({
    dyslexiaFont: false,
    colorBlindMode: false,
    focusMode: false,
    highContrast: false,
    voiceNav: true,
    animations: true
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-full overflow-y-auto"
    >
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-gov-blue mb-2">Accessibility Studio</h1>
        <p className="text-slate-500 text-lg">Customize your interaction experience.</p>
      </header>

      <div className="grid grid-cols-2 gap-8">
        {/* Visual Equalizer */}
        <GlassCard className="col-span-2 p-8 flex items-end justify-between h-48 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-gov-blue/5 to-transparent" />
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-2 bg-gov-blue/40 rounded-t-full"
              animate={{ 
                height: [20, Math.random() * 100 + 20, 20],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: i * 0.05,
                ease: "easeInOut"
              }}
            />
          ))}
        </GlassCard>

        {/* Settings Grid */}
        <div className="col-span-2 grid grid-cols-3 gap-6">
          {/* Dyslexia Font */}
          <GlassCard 
            className="p-6 cursor-pointer group" 
            hoverEffect 
            onClick={() => toggleSetting('dyslexiaFont')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${settings.dyslexiaFont ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Type className="w-6 h-6" />
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.dyslexiaFont ? 'bg-gov-blue' : 'bg-slate-200'}`}>
                <motion.div 
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                  animate={{ x: settings.dyslexiaFont ? 24 : 0 }}
                />
              </div>
            </div>
            <h3 className="font-bold text-slate-700 mb-1">Dyslexia Friendly</h3>
            <p className="text-xs text-slate-500">Optimized typeface for better readability.</p>
          </GlassCard>

          {/* Color Blind Mode */}
          <GlassCard 
            className="p-6 cursor-pointer group" 
            hoverEffect 
            onClick={() => toggleSetting('colorBlindMode')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${settings.colorBlindMode ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Palette className="w-6 h-6" />
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.colorBlindMode ? 'bg-gov-blue' : 'bg-slate-200'}`}>
                <motion.div 
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                  animate={{ x: settings.colorBlindMode ? 24 : 0 }}
                />
              </div>
            </div>
            <h3 className="font-bold text-slate-700 mb-1">Color Blind Mode</h3>
            <p className="text-xs text-slate-500">Adjusts UI colors for deuteranopia.</p>
          </GlassCard>

          {/* Focus Mode */}
          <GlassCard 
            className="p-6 cursor-pointer group" 
            hoverEffect 
            onClick={() => toggleSetting('focusMode')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${settings.focusMode ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Zap className="w-6 h-6" />
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.focusMode ? 'bg-gov-blue' : 'bg-slate-200'}`}>
                <motion.div 
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                  animate={{ x: settings.focusMode ? 24 : 0 }}
                />
              </div>
            </div>
            <h3 className="font-bold text-slate-700 mb-1">Focus Mode</h3>
            <p className="text-xs text-slate-500">Dims background distractions.</p>
          </GlassCard>

          {/* High Contrast */}
          <GlassCard 
            className="p-6 cursor-pointer group" 
            hoverEffect 
            onClick={() => toggleSetting('highContrast')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${settings.highContrast ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Eye className="w-6 h-6" />
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-gov-blue' : 'bg-slate-200'}`}>
                <motion.div 
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                  animate={{ x: settings.highContrast ? 24 : 0 }}
                />
              </div>
            </div>
            <h3 className="font-bold text-slate-700 mb-1">High Contrast</h3>
            <p className="text-xs text-slate-500">Increases UI contrast ratios.</p>
          </GlassCard>

          {/* Voice Navigation */}
          <GlassCard 
            className="p-6 cursor-pointer group" 
            hoverEffect 
            onClick={() => toggleSetting('voiceNav')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${settings.voiceNav ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Volume2 className="w-6 h-6" />
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.voiceNav ? 'bg-gov-blue' : 'bg-slate-200'}`}>
                <motion.div 
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                  animate={{ x: settings.voiceNav ? 24 : 0 }}
                />
              </div>
            </div>
            <h3 className="font-bold text-slate-700 mb-1">Voice Navigation</h3>
            <p className="text-xs text-slate-500">Enables voice command listening.</p>
          </GlassCard>

          {/* Reduced Motion */}
          <GlassCard 
            className="p-6 cursor-pointer group" 
            hoverEffect 
            onClick={() => toggleSetting('animations')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${settings.animations ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Monitor className="w-6 h-6" />
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.animations ? 'bg-gov-blue' : 'bg-slate-200'}`}>
                <motion.div 
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                  animate={{ x: settings.animations ? 24 : 0 }}
                />
              </div>
            </div>
            <h3 className="font-bold text-slate-700 mb-1">UI Animations</h3>
            <p className="text-xs text-slate-500">Toggle fluid interface motion.</p>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
};