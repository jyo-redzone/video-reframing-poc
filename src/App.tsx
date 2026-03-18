import TopBar from './components/TopBar';
import TrackPanel from './components/TrackPanel';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar />
      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
        <section className="col-span-12 lg:col-span-8">
          {/* PlayerPanel placeholder */}
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <div className="aspect-video w-full rounded-xl border bg-slate-900 flex items-center justify-center text-slate-500">
              Player (Task 005)
            </div>
          </div>
        </section>
        <aside className="col-span-12 lg:col-span-4">
          <TrackPanel />
        </aside>
        <section className="col-span-12">
          {/* TimelineBar placeholder */}
          <div className="rounded-2xl border bg-white shadow-sm p-4 h-40 flex items-center justify-center text-slate-400">
            Timeline (Task 006)
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
