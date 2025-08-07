import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="max-w-5xl mx-auto p-8 text-center">
      <div className="mb-8">
        <a href="https://vite.dev" target="_blank" className="inline-block">
          <img 
            src={viteLogo} 
            className="h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#646cffaa] will-change-auto" 
            alt="Vite logo" 
          />
        </a>
        <a href="https://react.dev" target="_blank" className="inline-block">
          <img 
            src={reactLogo} 
            className="h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#61dafbaa] will-change-auto animate-[spin_20s_linear_infinite]" 
            alt="React logo" 
          />
        </a>
      </div>
      <h1 className="text-5xl font-bold mb-8">Vite + React</h1>
      <div className="p-8 mb-8">
        <button 
          onClick={() => setCount((count) => count + 1)}
          className="px-6 py-3 bg-gray-800 text-white rounded-lg border border-transparent font-medium transition-colors hover:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
        >
          count is {count}
        </button>
        <p className="mt-4">
          Edit <code className="bg-gray-100 px-1 rounded">src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="text-gray-500">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App
