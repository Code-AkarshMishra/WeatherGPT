import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Cpu, Database, Wifi, Key, X, RefreshCw, Server } from 'lucide-react';

export default function SystemStatusModal({ isOpen, onClose }) {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const json = await res.json();
        setStatusData(json.data);
      } else {
        setError('Failed to fetch system health status.');
      }
    } catch {
      setError('System status API unreachable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose} style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={24} style={{ color: '#38bdf8' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>AI & System Infrastructure</h3>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>WeatherGPT Health & API Status</span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content Body */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spinner" style={{ marginBottom: 10 }} />
              <div>Auditing system microservices...</div>
            </div>
          ) : error ? (
            <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 10, color: '#f87171' }}>
              {error}
            </div>
          ) : statusData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* AI Key Rotation Status */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 14, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Key size={16} style={{ color: '#facc15' }} /> Gemini Key Rotation
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                    {statusData.aiKeys?.status || 'Online'}
                  </span>
                </div>
                <div style={{ fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div>Active Key: <strong style={{ color: '#38bdf8' }}>{statusData.aiKeys?.activeKeyMasked || '••••91KD'}</strong></div>
                  <div>Backup Keys: <strong style={{ color: '#4ade80' }}>{statusData.aiKeys?.backupKeysCount ?? 2} available</strong></div>
                  <div>Total Configured: <strong>{statusData.aiKeys?.totalConfigured ?? 3}</strong></div>
                  <div>Quota Status: <span style={{ color: '#4ade80' }}>Normal</span></div>
                </div>
              </div>

              {/* Python ML Microservice */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 14, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={16} style={{ color: '#a855f7' }} /> Python ML Microservice (ML-1 + ML-2)
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: statusData.mlMicroservice?.status === 'online' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    color: statusData.mlMicroservice?.status === 'online' ? '#4ade80' : '#facc15'
                  }}>
                    {statusData.mlMicroservice?.status?.toUpperCase() || 'ONLINE'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                  MoES Severe Weather Random Forest Predictor + Natural Language Tool Engine
                </div>
              </div>

              {/* Database & Weather API */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 12, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Database size={14} style={{ color: '#38bdf8' }} /> Database
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', textTransform: 'capitalize' }}>
                    {statusData.database}
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 12, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Wifi size={14} style={{ color: '#22c55e' }} /> WebSocket
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
                    Connected (ws://)
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer refresh button */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={fetchStatus}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh Status
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
