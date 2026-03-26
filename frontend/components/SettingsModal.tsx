import { AlertCircle, Check, Download, Film, Folder, Info, KeyRound, Settings, Sliders, Sparkles, X, Zap } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { useAppSettings, type AppSettings } from '../contexts/AppSettingsContext'
import { backendFetch } from '../lib/backend'
import { logger } from '../lib/logger'
import { ApiKeyHelperRow, LtxApiKeyInput, LtxApiKeyHelperRow } from './LtxApiKeyInput'

interface TextEncoderStatus {
  downloaded: boolean
  size_gb: number
  expected_size_gb: number
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: TabId
}

type TabId = 'general' | 'inference' | 'promptEnhancer' | 'about'

export function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  const { settings, updateSettings, saveLtxApiKey, saveFalApiKey, saveGeminiApiKey, forceApiGenerations } = useAppSettings()
  const onSettingsChange = (next: AppSettings) => updateSettings(next)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [ltxApiKeyInput, setLtxApiKeyInput] = useState('')
  const ltxApiKeyInputRef = useRef<HTMLInputElement>(null)
  const [focusLtxApiKeyInputOnTabChange, setFocusLtxApiKeyInputOnTabChange] = useState(false)
  const [falApiKeyInput, setFalApiKeyInput] = useState('')
  const falApiKeyInputRef = useRef<HTMLInputElement>(null)
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('')
  const geminiApiKeyInputRef = useRef<HTMLInputElement>(null)
  const [textEncoderStatus, setTextEncoderStatus] = useState<TextEncoderStatus | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [noticesText, setNoticesText] = useState<string | null>(null)
  const [noticesLoading, setNoticesLoading] = useState(false)
  const [showNotices, setShowNotices] = useState(false)
  const [modelLicenseText, setModelLicenseText] = useState<string | null>(null)
  const [modelLicenseLoading, setModelLicenseLoading] = useState(false)
  const [showModelLicense, setShowModelLicense] = useState(false)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
  const [projectAssetsPath, setProjectAssetsPath] = useState('')
  const [comfyuiModels, setComfyuiModels] = useState<{
    available: boolean
    checkpoints: string[]
    loras: string[]
    upscale_models: string[]
    text_encoders: string[]
    vae: string[]
    diffusion_models: string[]
    latent_upscale_models: string[]
  } | null>(null)
  const [comfyuiModelsLoading, setComfyuiModelsLoading] = useState(false)
  const [modelsSubTab, setModelsSubTab] = useState<'ltx' | 'image' | 'upscaling'>('ltx')

  // Sync active tab with initialTab prop when modal opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Fetch app version when About tab is shown
  useEffect(() => {
    if (activeTab !== 'about' || appVersion) return
    window.electronAPI.getAppInfo().then(info => setAppVersion(info.version)).catch(() => {})
  }, [activeTab, appVersion])

  // Fetch analytics state when modal opens
  useEffect(() => {
    if (!isOpen) return
    window.electronAPI.getAnalyticsState()
      .then((state: { analyticsEnabled: boolean }) => setAnalyticsEnabled(state.analyticsEnabled))
      .catch(() => {})
    window.electronAPI.getProjectAssetsPath()
      .then((p: string) => setProjectAssetsPath(p))
      .catch(() => {})
  }, [isOpen])

  // Fetch text encoder status when modal opens
  useEffect(() => {
    if (!isOpen) return

    const fetchStatus = async () => {
      try {
        const response = await backendFetch('/api/models/status')
        if (response.ok) {
          const data = await response.json()
          setTextEncoderStatus(data.text_encoder_status)
        }
      } catch (e) {
        logger.error(`Failed to fetch text encoder status: ${e}`)
      }
    }

    fetchStatus()
    // Poll while downloading
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [isOpen, isDownloading])

  // Fetch ComfyUI available models when Models tab is shown
  useEffect(() => {
    if (!isOpen || activeTab !== 'inference') return
    setComfyuiModelsLoading(true)
    const fetchModels = async () => {
      try {
        const response = await backendFetch('/api/comfyui/models')
        if (response.ok) {
          const data = await response.json()
          setComfyuiModels(data)
        }
      } catch (e) {
        logger.error(`Failed to fetch ComfyUI models: ${e}`)
      } finally {
        setComfyuiModelsLoading(false)
      }
    }
    fetchModels()
  }, [isOpen, activeTab])

  // Handle text encoder download
  const handleDownloadTextEncoder = async () => {
    setIsDownloading(true)
    setDownloadError(null)
    try {
      const response = await backendFetch('/api/text-encoder/download', { method: 'POST' })
      const data = await response.json()

      if (data.status === 'already_downloaded') {
        setTextEncoderStatus(prev => prev ? { ...prev, downloaded: true } : null)
      }
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await backendFetch('/api/models/status')
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            setTextEncoderStatus(statusData.text_encoder_status)
            if (statusData.text_encoder_status?.downloaded) {
              setIsDownloading(false)
              clearInterval(pollInterval)
            }
          }
        } catch {
          // ignore
        }
      }, 2000)

      // Timeout after 30 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        if (isDownloading) setIsDownloading(false)
      }, 30 * 60 * 1000)
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed')
      setIsDownloading(false)
    }
  }

  if (!isOpen) return null

  const handleToggleTorchCompile = () => {
    onSettingsChange({
      ...settings,
      useTorchCompile: !settings.useTorchCompile,
    })
  }

  const handleToggleLoadOnStartup = () => {
    onSettingsChange({
      ...settings,
      loadOnStartup: !settings.loadOnStartup,
    })
  }

  const handleToggleLocalEncoder = () => {
    onSettingsChange({
      ...settings,
      useLocalTextEncoder: !settings.useLocalTextEncoder,
    })
  }

  const handlePromptCacheSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = Math.max(0, Math.min(1000, parseInt(e.target.value) || 100))
    onSettingsChange({
      ...settings,
      promptCacheSize: size,
    })
  }

  const handleFastUpscalerToggle = () => {
    onSettingsChange({
      ...settings,
      fastModel: { ...settings.fastModel, useUpscaler: !settings.fastModel?.useUpscaler },
    })
  }

  const handleComfyUIModelChange = (field: string, value: string) => {
    onSettingsChange({
      ...settings,
      comfyuiModels: { ...settings.comfyuiModels, [field]: value },
    })
  }

  const handleProStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const steps = Math.max(1, Math.min(100, parseInt(e.target.value) || 20))
    onSettingsChange({
      ...settings,
      proModel: { ...settings.proModel, steps },
    })
  }

  const handleProUpscalerToggle = () => {
    onSettingsChange({
      ...settings,
      proModel: { ...settings.proModel, useUpscaler: !settings.proModel.useUpscaler },
    })
  }

  // Prompt Enhancer handlers
  const handleTogglePromptEnhancer = (mode: 't2v' | 'i2v') => {
    if (mode === 't2v') {
      onSettingsChange({ ...settings, promptEnhancerEnabledT2V: !settings.promptEnhancerEnabledT2V })
    } else {
      onSettingsChange({ ...settings, promptEnhancerEnabledI2V: !settings.promptEnhancerEnabledI2V })
    }
  }
  // Analytics handler
  const handleToggleAnalytics = () => {
    const next = !analyticsEnabled
    setAnalyticsEnabled(next)
    window.electronAPI.setAnalyticsEnabled(next).catch(() => {})
  }

  // Seed handlers
  const handleToggleSeedLock = () => {
    onSettingsChange({
      ...settings,
      seedLocked: !settings.seedLocked,
    })
  }

  const handleLockedSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0
    onSettingsChange({
      ...settings,
      lockedSeed: Math.max(0, Math.min(2147483647, value)),
    })
  }

  const handleRandomizeSeed = () => {
    onSettingsChange({
      ...settings,
      lockedSeed: Math.floor(Math.random() * 2147483647),
    })
  }

  const handleLoadModelLicense = async () => {
    setModelLicenseLoading(true)
    try {
      const text = await window.electronAPI.fetchLicenseText()
      setModelLicenseText(text)
      setShowModelLicense(true)
    } catch (e) {
      logger.error(`Failed to load model license: ${e}`)
    } finally {
      setModelLicenseLoading(false)
    }
  }

  const handleLoadNotices = async () => {
    setNoticesLoading(true)
    try {
      const text = await window.electronAPI.getNoticesText()
      setNoticesText(text)
      setShowNotices(true)
    } catch (e) {
      logger.error(`Failed to load notices: ${e}`)
    } finally {
      setNoticesLoading(false)
    }
  }

  const tabs = [
    { id: 'general' as TabId, label: 'General', icon: Settings },
    { id: 'inference' as TabId, label: 'Models', icon: Sliders },
    { id: 'promptEnhancer' as TabId, label: 'Prompt Enhancer', icon: Sparkles },
    { id: 'about' as TabId, label: 'About', icon: Info },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-blue-500 -mb-px'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 h-[60vh] overflow-y-auto">
          {activeTab === 'general' && (
            <>
              {/* Project Assets Path */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Project Assets Path</h3>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Where generated video and image assets are saved. Each project gets a subfolder.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm truncate select-text">
                    {projectAssetsPath || <span className="text-zinc-600">Not set</span>}
                  </div>
                  <Button
                    variant="outline"
                    className="border-zinc-700 flex-shrink-0"
                    onClick={async () => {
                      const result = await window.electronAPI.openProjectAssetsPathChangeDialog()
                      if (result.success && result.path) {
                        setProjectAssetsPath(result.path)
                      }
                    }}
                  >
                    <Folder className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {!forceApiGenerations && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">Videos Generation</h3>
                  </div>

                  <div
                    className={`bg-zinc-800/50 rounded-lg p-4 border-2 transition-colors cursor-pointer ${
                      settings.userPrefersLtxApiVideoGenerations ? 'border-blue-500' : 'border-transparent hover:border-zinc-600'
                    }`}
                    onClick={() => {
                      onSettingsChange({
                        ...settings,
                        userPrefersLtxApiVideoGenerations: !settings.userPrefersLtxApiVideoGenerations,
                      })
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium text-white">Generate With API</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          Use LTX API for video generation when an LTX API key is configured.
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        settings.userPrefersLtxApiVideoGenerations ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                      }`}>
                        {settings.userPrefersLtxApiVideoGenerations && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>

                    {!settings.hasLtxApiKey && (
                      <div className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" />
                        API key required — configure it in the API Keys tab.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Text Encoding Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <h3 className="text-sm font-semibold text-white">Text Encoding</h3>
                </div>

                <p className="text-xs text-zinc-500 leading-relaxed">
                  Text encoding converts your prompt into data the AI understands. Choose how to do this.
                </p>

                {/* LTX API Option (Default) */}
                <div
                  className={`bg-zinc-800/50 rounded-lg p-4 border-2 transition-colors cursor-pointer ${
                    !settings.useLocalTextEncoder ? 'border-blue-500' : 'border-transparent hover:border-zinc-600'
                  }`}
                  onClick={() => {
                    if (!settings.useLocalTextEncoder) return
                    handleToggleLocalEncoder()
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">LTX API</span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Recommended</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Fast cloud-based text encoding (~1 second). Requires an LTX API key configured in the API Keys tab.
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      !settings.useLocalTextEncoder ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                    }`}>
                      {!settings.useLocalTextEncoder && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>

                  {/* Warning when selected but no key */}
                  {!settings.useLocalTextEncoder && !settings.hasLtxApiKey && (
                    <div className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3" />
                      API key required — configure it in the API Keys tab.
                    </div>
                  )}

                  {/* Prompt Cache Size — only relevant for API text encoding */}
                  {!settings.useLocalTextEncoder && settings.hasLtxApiKey && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-700/50">
                      <div>
                        <label className="text-xs text-white">Prompt Cache</label>
                        <p className="text-xs text-zinc-500">Skip repeat encoding calls</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={settings.promptCacheSize ?? 100}
                        onChange={handlePromptCacheSizeChange}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-xs text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Local Encoder Option */}
                <div
                  className={`bg-zinc-800/50 rounded-lg p-4 border-2 transition-colors cursor-pointer ${
                    settings.useLocalTextEncoder ? 'border-blue-500' : 'border-transparent hover:border-zinc-600'
                  }`}
                  onClick={() => !settings.useLocalTextEncoder && handleToggleLocalEncoder()}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                          <path d="M9 9h6m-6 3h6m-6 3h4" />
                        </svg>
                        <span className="text-sm font-medium text-white">Local Encoder</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Run on your computer (~23 seconds). Requires 25 GB download.
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      settings.useLocalTextEncoder ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                    }`}>
                      {settings.useLocalTextEncoder && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>

                  {/* Download Status - show when this option is selected */}
                  {settings.useLocalTextEncoder && (
                    <div className="mt-3 pt-3 border-t border-zinc-700/50">
                      {textEncoderStatus?.downloaded ? (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                          <Check className="h-4 w-4" />
                          <span>Downloaded ({textEncoderStatus.size_gb} GB)</span>
                        </div>
                      ) : isDownloading ? (
                        <div className="flex items-center gap-2 text-xs text-blue-400">
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <span>Downloading text encoder...</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertCircle className="h-4 w-4" />
                            <span>Not downloaded ({textEncoderStatus?.expected_size_gb || 8} GB required)</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadTextEncoder()
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs"
                          >
                            <Download className="h-3 w-3 mr-2" />
                            Download Text Encoder
                          </Button>
                          {downloadError && (
                            <p className="text-xs text-red-400">{downloadError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Load on Startup Setting */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                      </svg>
                      <label className="text-sm font-medium text-white">
                        Preload models on startup
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Load AI models in the background after the app starts. The video model is loaded
                      and warmed up on GPU, and the image model is preloaded into CPU RAM for faster
                      first generation. When disabled, models load on first use (faster startup, slower
                      first generation). Requires app restart to take effect.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={handleToggleLoadOnStartup}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.loadOnStartup ? 'bg-blue-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.loadOnStartup ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Status indicator */}
                <div className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1.5 ${
                  settings.loadOnStartup
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    settings.loadOnStartup ? 'bg-blue-400' : 'bg-zinc-600'
                  }`} />
                  {settings.loadOnStartup ? 'Models preload in background at startup' : 'Models load on first generation'}
                </div>
              </div>

              {/* Torch Compile Setting */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      <label className="text-sm font-medium text-white">
                        Torch Compile
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Compiles the model for optimized inference. <span className="text-orange-400">Experimental:</span> First
                      generation can take 5-10+ minutes for compilation. Subsequent generations may be
                      20-40% faster. Requires app restart to take effect.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={handleToggleTorchCompile}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.useTorchCompile ? 'bg-orange-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.useTorchCompile ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Status indicator */}
                <div className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1.5 ${
                  settings.useTorchCompile
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    settings.useTorchCompile ? 'bg-orange-400' : 'bg-zinc-600'
                  }`} />
                  {settings.useTorchCompile ? 'Optimized inference (recommended)' : 'Standard inference'}
                </div>
              </div>

              {/* Seed Lock Setting */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <label className="text-sm font-medium text-white">
                        Lock Seed
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Use the same seed for reproducible generations. When unlocked, a random seed is used each time.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={handleToggleSeedLock}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.seedLocked ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.seedLocked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Seed input - only show when locked */}
                {settings.seedLocked && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="2147483647"
                      value={settings.lockedSeed ?? 42}
                      onChange={handleLockedSeedChange}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Enter seed..."
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRandomizeSeed}
                      className="h-9 px-3 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800"
                      title="Generate random seed"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                      </svg>
                    </Button>
                  </div>
                )}

                {/* Status indicator */}
                <div className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1.5 ${
                  settings.seedLocked
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    settings.seedLocked ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`} />
                  {settings.seedLocked ? `Seed locked: ${settings.lockedSeed ?? 42}` : 'Random seed each generation'}
                </div>
              </div>

              {/* Anonymous Analytics Setting */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      <label className="text-sm font-medium text-white">
                        Anonymous Analytics
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Share anonymous usage data to help improve LTX Desktop.
                      Only basic technical information is collected — never personal data or generated content.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={handleToggleAnalytics}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      analyticsEnabled ? 'bg-violet-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        analyticsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

              </div>
            </>
          )}

          {activeTab === 'inference' && (
            <>
              {/* Sub-tabs */}
              <div className="flex gap-1 mb-4 bg-zinc-800/50 rounded-lg p-1">
                {([
                  { id: 'ltx' as const, label: 'LTX Models' },
                  { id: 'image' as const, label: 'Image Models', disabled: true },
                  { id: 'upscaling' as const, label: 'Upscaling Models', disabled: true },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => !('disabled' in tab && tab.disabled) && setModelsSubTab(tab.id)}
                    disabled={'disabled' in tab && tab.disabled}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      modelsSubTab === tab.id
                        ? 'bg-zinc-700 text-white'
                        : 'disabled' in tab && tab.disabled
                          ? 'text-zinc-600 cursor-not-allowed'
                          : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                    {'disabled' in tab && tab.disabled && <span className="ml-1 text-[9px] text-zinc-600">soon</span>}
                  </button>
                ))}
              </div>

              {modelsSubTab === 'ltx' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Select the models for LTX video generation. Loaded from your ComfyUI model folders.
                    Empty selections use the workflow defaults.
                  </p>

                  {comfyuiModelsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 py-4">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Loading models...
                    </div>
                  ) : (
                    <>
                      {/* Checkpoint / Diffusion Model */}
                      <ModelDropdown
                        label="Checkpoint"
                        description="Main model (checkpoints/ or diffusion_models/)"
                        value={settings.comfyuiModels?.checkpoint ?? ''}
                        options={[
                          ...(comfyuiModels?.checkpoints ?? []),
                          ...(comfyuiModels?.diffusion_models ?? []),
                        ]}
                        onChange={(v) => handleComfyUIModelChange('checkpoint', v)}
                      />

                      {/* Text Encoder */}
                      <ModelDropdown
                        label="Text Encoder"
                        description="Text encoder model (text_encoders/)"
                        value={settings.comfyuiModels?.textEncoder ?? ''}
                        options={comfyuiModels?.text_encoders ?? []}
                        onChange={(v) => handleComfyUIModelChange('textEncoder', v)}
                      />

                      {/* Video VAE */}
                      <ModelDropdown
                        label="Video VAE"
                        description="Video decoder/encoder (vae/)"
                        value={settings.comfyuiModels?.videoVae ?? ''}
                        options={comfyuiModels?.vae ?? []}
                        onChange={(v) => handleComfyUIModelChange('videoVae', v)}
                      />

                      {/* Audio VAE */}
                      <ModelDropdown
                        label="Audio VAE"
                        description="Audio decoder/encoder (vae/)"
                        value={settings.comfyuiModels?.audioVae ?? ''}
                        options={comfyuiModels?.vae ?? []}
                        onChange={(v) => handleComfyUIModelChange('audioVae', v)}
                      />

                      {/* Distilled LoRA */}
                      <ModelDropdown
                        label="Distilled LoRA"
                        description="Fast inference LoRA (loras/)"
                        value={settings.comfyuiModels?.distilledLora ?? ''}
                        options={comfyuiModels?.loras ?? []}
                        onChange={(v) => handleComfyUIModelChange('distilledLora', v)}
                      />

                      {/* Spatial Upscale Model */}
                      <ModelDropdown
                        label="Spatial Upscale Model"
                        description="Spatial latent upscaler (latent_upscale_models/)"
                        value={settings.comfyuiModels?.spatialUpscaleModel ?? ''}
                        options={comfyuiModels?.latent_upscale_models ?? []}
                        onChange={(v) => handleComfyUIModelChange('spatialUpscaleModel', v)}
                      />

                      {/* Temporal Upscale Model */}
                      <ModelDropdown
                        label="Temporal Upscale Model"
                        description="Temporal latent upscaler (latent_upscale_models/)"
                        value={settings.comfyuiModels?.temporalUpscaleModel ?? ''}
                        options={comfyuiModels?.latent_upscale_models ?? []}
                        onChange={(v) => handleComfyUIModelChange('temporalUpscaleModel', v)}
                      />

                      {/* Refresh button */}
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-zinc-700 text-zinc-400 hover:text-white"
                          onClick={() => {
                            setComfyuiModelsLoading(true)
                            backendFetch('/api/comfyui/models')
                              .then(r => r.json())
                              .then(data => setComfyuiModels(data))
                              .catch(e => logger.error(`Refresh failed: ${e}`))
                              .finally(() => setComfyuiModelsLoading(false))
                          }}
                        >
                          Refresh Model Lists
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {modelsSubTab === 'image' && (
                <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
                  Image model selection coming soon
                </div>
              )}

              {modelsSubTab === 'upscaling' && (
                <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
                  Upscaling model selection coming soon
                </div>
              )}
            </>
          )}

          {activeTab === 'promptEnhancer' && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Prompt Enhancer</h3>
                </div>

                <p className="text-xs text-zinc-500 leading-relaxed">
                  Automatically enhances your prompts via the LTX API with rich visual details, sound descriptions,
                  and motion cues to help generate higher quality videos. Control independently for each generation type.
                </p>

                {!settings.hasLtxApiKey ? (
                  <div className="space-y-4 mt-2">
                    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Info className="h-4 w-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <p className="text-sm text-zinc-300 font-medium">Prompt enhancement unavailable</p>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            Prompt enhancement requires the LTX cloud API which is not configured in this local installation.
                            Your prompts will be used as-is.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* T2V Toggle */}
                    <div
                      className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3 border border-zinc-700/50 cursor-pointer"
                      onClick={() => handleTogglePromptEnhancer('t2v')}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">T2V</span>
                        <div>
                          <span className="text-sm text-zinc-200">Text-to-Video</span>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {settings.promptEnhancerEnabledT2V ? 'Prompts will be enhanced before T2V generation' : 'T2V prompts used as-is'}
                          </p>
                        </div>
                      </div>
                      <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        settings.promptEnhancerEnabledT2V ? 'bg-blue-500' : 'bg-zinc-700'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform pointer-events-none ${
                          settings.promptEnhancerEnabledT2V ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>

                    {/* I2V Toggle */}
                    <div
                      className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3 border border-zinc-700/50 cursor-pointer"
                      onClick={() => handleTogglePromptEnhancer('i2v')}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">I2V</span>
                        <div>
                          <span className="text-sm text-zinc-200">Image-to-Video</span>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {settings.promptEnhancerEnabledI2V ? 'Prompts will be enhanced before I2V generation' : 'I2V prompts used as-is'}
                          </p>
                        </div>
                      </div>
                      <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        settings.promptEnhancerEnabledI2V ? 'bg-blue-500' : 'bg-zinc-700'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform pointer-events-none ${
                          settings.promptEnhancerEnabledI2V ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'about' && (
            <>
              {showModelLicense ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">LTX-2 Model License</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowModelLicense(false)}
                      className="h-7 px-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800"
                    >
                      Back
                    </Button>
                  </div>
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded-lg p-4 max-h-[50vh] overflow-y-auto border border-zinc-700/50">
                    {modelLicenseText}
                  </pre>
                </div>
              ) : showNotices ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Third-Party Notices</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNotices(false)}
                      className="h-7 px-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800"
                    >
                      Back
                    </Button>
                  </div>
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded-lg p-4 max-h-[50vh] overflow-y-auto border border-zinc-700/50">
                    {noticesText}
                  </pre>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* App Identity */}
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold text-white">LTX Desktop</h3>
                    <p className="text-sm text-zinc-400">Version {appVersion || '...'}</p>
                    <p className="text-xs text-zinc-500">AI-Powered Video Editor</p>
                  </div>

                  {/* License */}
                  <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">License</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Licensed under the Apache License, Version 2.0
                    </p>
                  </div>

                  {/* LTX-2 Model License */}
                  <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                      <span className="text-sm font-medium text-white">LTX-2 Model License</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      The LTX-2 model is subject to the LTX-2 Community License Agreement, accepted during first-run setup.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleLoadModelLicense}
                      disabled={modelLicenseLoading}
                      className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs"
                    >
                      {modelLicenseLoading ? 'Loading...' : 'View Model License'}
                    </Button>
                  </div>

                  {/* Third-Party Notices */}
                  <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      <span className="text-sm font-medium text-white">Third-Party Notices</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      This application uses open-source software and AI models subject to their own license terms.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleLoadNotices}
                      disabled={noticesLoading}
                      className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs"
                    >
                      {noticesLoading ? 'Loading...' : 'View Third-Party Notices'}
                    </Button>
                  </div>

                  {/* Copyright */}
                  <p className="text-center text-xs text-zinc-600">
                    Copyright © 2026 Lightricks
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-zinc-700 hover:bg-zinc-600 text-white"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Reusable model dropdown for the Models settings tab. */
function ModelDropdown({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string
  description: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  // Deduplicate and sort
  const uniqueOptions = [...new Set(options)].sort()

  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 space-y-1.5">
      <div>
        <label className="text-sm text-white font-medium">{label}</label>
        <p className="text-[11px] text-zinc-500">{description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
        }}
      >
        <option value="">— Use workflow default —</option>
        {uniqueOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

export type { AppSettings, TabId as SettingsTabId }
