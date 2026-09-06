import { useState, useCallback } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useChat } from '../hooks/useChat';
import WeatherWidget from '../components/WeatherWidget';
import Sidebar from '../components/Sidebar';
import ChatPanel from '../components/ChatPanel';
import ChatInput from '../components/ChatInput';
import Navbar from '../components/Navbar';

export default function Home() {
  const [selectedRole, setSelectedRole] = useState('citizen');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [prefillText, setPrefillText] = useState('');
  const [overrideLat, setOverrideLat] = useState(null);
  const [overrideLon, setOverrideLon] = useState(null);

  const { lat: geoLat, lon: geoLon } = useGeolocation();
  const lat = overrideLat ?? geoLat;
  const lon = overrideLon ?? geoLon;

  const { messages, loading, error, suggestedRole, sendMessage, clearConversation, setSuggestedRole } =
    useChat({ role: selectedRole, lat, lon });

  const handleFeatureSelect = useCallback((query) => {
    setSidebarOpen(false);
    setPrefillText(query);
    // Pre-fill handled by ChatInput via prefillText prop
  }, []);

  const handleSend = useCallback((text) => {
    setPrefillText('');
    sendMessage(text);
  }, [sendMessage]);

  const handleLocationChange = useCallback((newLat, newLon) => {
    setOverrideLat(newLat);
    setOverrideLon(newLon);
  }, []);

  return (
    <div className="app-shell">
      <Navbar
        onMenuToggle={() => setSidebarOpen((o) => !o)}
        sidebarOpen={sidebarOpen}
      />

      <WeatherWidget
        lat={lat}
        lon={lon}
        onLocationChange={handleLocationChange}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
          id="sidebar-overlay"
        />
      )}

      <div className="main-area">
        <Sidebar
          selectedRole={selectedRole}
          onRoleChange={(role) => {
            setSelectedRole(role);
            clearConversation();
          }}
          onFeatureSelect={handleFeatureSelect}
          isOpen={sidebarOpen}
          isExpanded={sidebarExpanded}
          onToggleExpand={() => setSidebarExpanded((e) => !e)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <ChatPanel
            messages={messages}
            loading={loading}
            error={error}
            selectedRole={selectedRole}
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
    </div>
  );
}
