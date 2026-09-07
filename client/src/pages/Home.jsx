import { useState, useCallback } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useWeather } from '../hooks/useWeather';
import { useChat } from '../hooks/useChat';
import WeatherIntelligencePanel from '../components/WeatherIntelligencePanel';
import ChatPanel from '../components/ChatPanel';
import ChatInput from '../components/ChatInput';
import Navbar from '../components/Navbar';
import AtmosphericCanvas from '../components/AtmosphericCanvas';
import LocationSelectorModal from '../components/LocationSelectorModal';

export default function Home() {
  const [selectedRole, setSelectedRole] = useState('citizen');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefillText, setPrefillText] = useState('');
  const [overrideLat, setOverrideLat] = useState(null);
  const [overrideLon, setOverrideLon] = useState(null);
  const [locationName, setLocationName] = useState('Lucknow, Uttar Pradesh');
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('weather'); // mobile tab: 'weather' | 'chat'

  const { lat: geoLat, lon: geoLon } = useGeolocation();
  const lat = overrideLat ?? (geoLat || 26.8467);
  const lon = overrideLon ?? (geoLon || 80.9462);

  const { data: weatherData, loading: weatherLoading } = useWeather(lat, lon);

  const { messages, loading, error, suggestedRole, sendMessage, clearConversation, setSuggestedRole } =
    useChat({ role: selectedRole, lat, lon });

  const handleFeatureSelect = useCallback((query) => {
    setSidebarOpen(false);
    setPrefillText(query);
    setActiveTab('chat'); // switch to chat tab on mobile when a query is selected
  }, []);

  const handleSend = useCallback((text) => {
    setPrefillText('');
    sendMessage(text);
  }, [sendMessage]);

  const handleLocationChange = useCallback((newLat, newLon, newName) => {
    setOverrideLat(newLat);
    setOverrideLon(newLon);
    if (newName) setLocationName(newName);
  }, []);

  const activeCondition = weatherData?.condition || 'clear';
  const activeRainProb = weatherData?.rainProbability ?? 40;
  const activeCityName = weatherData?.locationName
    ? `${weatherData.locationName}, ${weatherData.country || 'IN'}`
    : locationName;

  return (
    <div className="app-shell" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Dynamic Weather-Alive Canvas Background */}
      <AtmosphericCanvas
        condition={activeCondition}
        rainProbability={activeRainProb}
        interactive={true}
      />

      <Navbar
        onMenuToggle={() => setSidebarOpen((o) => !o)}
        sidebarOpen={sidebarOpen}
        currentLocationName={activeCityName}
        onLocationChange={handleLocationChange}
      />

      {/* Main Split Container */}
      <div className="main-split-container" style={{ position: 'relative', zIndex: 1, marginTop: 'var(--navbar-height, 60px)' }}>
        {/* LEFT PANEL: Weather Intelligence Command Center */}
        <div className={`left-weather-intelligence-panel${activeTab !== 'weather' ? ' panel-hidden' : ''}`}>
          <WeatherIntelligencePanel
            weatherData={weatherData}
            loading={weatherLoading}
            onOpenLocationModal={() => setLocationModalOpen(true)}
          />
        </div>

        {/* RIGHT PANEL: Conversational WeatherGPT AI Workspace */}
        <div className={`right-chat-workspace-panel${activeTab !== 'chat' ? ' panel-hidden' : ''}`}>
          <ChatPanel
            messages={messages}
            loading={loading}
            error={error}
            selectedRole={selectedRole}
            onRoleChange={(role) => {
              setSelectedRole(role);
              clearConversation();
            }}
            onFeatureSelect={handleFeatureSelect}
            suggestedRole={suggestedRole}
            onRoleSwitch={(role) => { setSelectedRole(role); clearConversation(); }}
            onDismissSuggestion={() => setSuggestedRole(null)}
          />
          <ChatInput
            onSend={handleSend}
            loading={loading}
            selectedRole={selectedRole}
            initialText={prefillText}
          />
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-tab-bar" role="tablist" aria-label="Main navigation tabs">
        <button
          className={`mobile-tab-btn${activeTab === 'weather' ? ' active' : ''}`}
          onClick={() => setActiveTab('weather')}
          role="tab"
          aria-selected={activeTab === 'weather'}
          aria-label="Weather panel"
        >
          <span className="tab-icon">🌤️</span>
          <span>Weather</span>
        </button>
        <button
          className={`mobile-tab-btn${activeTab === 'chat' ? ' active' : ''}`}
          onClick={() => setActiveTab('chat')}
          role="tab"
          aria-selected={activeTab === 'chat'}
          aria-label="AI Chat panel"
        >
          <span className="tab-icon">💬</span>
          <span>AI Chat</span>
        </button>
      </nav>

      <LocationSelectorModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelectLocation={handleLocationChange}
        currentLocationName={activeCityName}
      />
    </div>
  );
}

