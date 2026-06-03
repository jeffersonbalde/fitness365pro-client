import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Login from './pages/public/Login.jsx'
import Register from './pages/public/Register.jsx'
import VerifyEmail from './pages/public/VerifyEmail.jsx'
import ForgotPassword from './pages/public/ForgotPassword.jsx'
import ResetPassword from './pages/public/ResetPassword.jsx'
import Dashboard from './pages/dashboard/Dashboard.jsx'
import Profile from './pages/profile/Profile.jsx'
import ProfileTransactionsPage from './pages/profile/ProfileTransactionsPage.jsx'
import ProfileMembersPage from './pages/profile/ProfileMembersPage.jsx'
import ProfileRaceResultsPage from './pages/profile/ProfileRaceResultsPage.jsx'
import UserProfile from './pages/profile/UserProfile.jsx'
import Settings from './pages/settings/Settings.jsx'
import Onboarding from './pages/onboarding/Onboarding.jsx'
import Workout from './pages/workout/Workout.jsx'
import Communities from './pages/community/Communities.jsx'
import SuggestedPeople from './pages/social/SuggestedPeople.jsx'
import Leaderboards from './pages/leaderboards/Leaderboards.jsx'
import EventLeaderboard from './pages/leaderboards/EventLeaderboard.jsx'
import SharedLeaderboardPage from './pages/leaderboards/SharedLeaderboardPage.jsx'
import Challenges from './pages/challenges/Challenges.jsx'
import EventDetails from './pages/challenges/EventDetails.jsx'
import EventRegistrationFlow from './pages/challenges/EventRegistrationFlow.jsx'
import Notifications from './pages/notifications/Notifications.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminCmsPosts from './pages/admin/AdminCmsPosts.jsx'
import AdminEvents from './pages/admin/AdminEvents.jsx'
import AdminEventProgress from './pages/admin/AdminEventProgress.jsx'
import AdminEventParticipants from './pages/admin/AdminEventParticipants.jsx'
import AdminMembers from './pages/admin/AdminMembers.jsx'
import SharedBadgePage from './pages/badges/SharedBadgePage.jsx'
import MainAppLayout from './layouts/MainAppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        element={
          <ProtectedRoute>
            <MainAppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile/transactions" element={<ProfileTransactionsPage />} />
        <Route path="/profile/members" element={<ProfileMembersPage />} />
        <Route path="/profile/race-results" element={<ProfileRaceResultsPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:clientId" element={<UserProfile />} />
        <Route path="/badge/:clientId/:eventId/:badgeKey" element={<SharedBadgePage />} />
        <Route path="/leaderboard/:eventId/:clientId" element={<SharedLeaderboardPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/suggested-people" element={<SuggestedPeople />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/leaderboards/:eventId" element={<EventLeaderboard />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/:eventId/register" element={<EventRegistrationFlow />} />
        <Route path="/challenges/:eventId" element={<EventDetails />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<Navigate to="/admin/cms/posts" replace />} />
      <Route path="/admin/dashboard" element={<Navigate to="/admin/cms/posts" replace />} />
      <Route path="/admin/cms/posts" element={<AdminCmsPosts />} />
      <Route path="/admin/cms/events" element={<AdminEvents />} />
      <Route path="/admin/cms/event-progress" element={<AdminEventProgress />} />
      <Route path="/admin/cms/event-participants" element={<AdminEventParticipants />} />
      <Route path="/admin/cms/members" element={<AdminMembers />} />
      <Route path="/admin/cms/announcements" element={<Navigate to="/admin/cms/posts" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin/cms/posts" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App