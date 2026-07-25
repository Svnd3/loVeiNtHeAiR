import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Details from './pages/Details'
import Account from './pages/Account'
import ResetPassword from './pages/ResetPassword'
import Terms from './pages/Terms'
import Surprise from './pages/Surprise'
import SharedSurprise from './pages/SharedSurprise'
import CookieBanner from './components/CookieBanner'
import RequireAuth from './components/RequireAuth'
import AccountButton from './components/AccountButton'
import { AuthProvider } from './lib/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/details"
            element={
              <RequireAuth>
                <Details />
              </RequireAuth>
            }
          />
          <Route
            path="/details/:id"
            element={
              <RequireAuth>
                <Details />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <Account />
              </RequireAuth>
            }
          />
          <Route
            path="/reset-password"
            element={
              <RequireAuth>
                <ResetPassword />
              </RequireAuth>
            }
          />
          <Route path="/terms" element={<Terms />} />
          <Route path="/surprise" element={<Surprise />} />
          <Route path="/s/:id" element={<SharedSurprise />} />
        </Routes>
        <AccountButton />
        <CookieBanner />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
