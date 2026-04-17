import { motion } from 'framer-motion';

export function ScanningDocumentAnimation({ className = '' }) {
  return (
    <div className={`relative mx-auto h-28 w-24 ${className}`}>
      <motion.div
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-xl border border-blue-300/70 bg-gradient-to-b from-white/90 to-blue-50/70 shadow-sm dark:border-blue-300/40 dark:from-slate-900/90 dark:to-blue-500/10"
      />

      <div className="absolute left-3 right-3 top-4 space-y-2">
        <div className="h-1.5 rounded bg-slate-300/70 dark:bg-black" />
        <div className="h-1.5 w-4/5 rounded bg-slate-300/70 dark:bg-black" />
        <div className="h-1.5 w-2/3 rounded bg-slate-300/70 dark:bg-black" />
      </div>

      <motion.div
        initial={{ y: 10 }}
        animate={{ y: 92 }}
        transition={{ duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        className="absolute left-1 right-1 h-0.5 rounded-full bg-gradient-to-r from-transparent via-blue-500 to-transparent dark:via-blue-300"
      />

      <motion.div
        initial={{ y: 10 }}
        animate={{ y: 92 }}
        transition={{ duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        className="absolute inset-x-1 h-10 bg-gradient-to-b from-blue-400/20 via-blue-300/10 to-transparent dark:from-blue-300/20"
      />
    </div>
  );
}
