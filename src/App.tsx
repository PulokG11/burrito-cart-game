import { FinalScreen } from './components/FinalScreen'
import { Header } from './components/Header'
import { HomeScreen } from './components/HomeScreen'
import { PlayScreen } from './components/PlayScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { useGame } from './store/game'

export default function App() {
  const screen = useGame((s) => s.screen)
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Header />
      {screen === 'home' && <HomeScreen />}
      {screen === 'play' && <PlayScreen />}
      {screen === 'results' && <ResultsScreen />}
      {screen === 'final' && <FinalScreen />}
    </div>
  )
}
