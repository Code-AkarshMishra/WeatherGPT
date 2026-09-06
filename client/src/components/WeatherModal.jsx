import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import WeatherAtmosphericCard from './WeatherAtmosphericCard';

export default function WeatherModal({ isOpen, onClose, data, loading, onLocationChange }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="atmospheric-modal-overlay" onClick={onClose}>
        <motion.div
          className="atmospheric-modal-container"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Close button */}
          <button
            className="atmospheric-modal-close"
            onClick={onClose}
            aria-label="Close Weather View"
          >
            <X size={20} />
          </button>

          {/* Full Card */}
          <WeatherAtmosphericCard
            data={data}
            loading={loading}
            onLocationChange={onLocationChange}
            isFullScreen={false}
            showFullDetails={true}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
