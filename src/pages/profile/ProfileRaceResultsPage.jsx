import React from 'react'
import ProfileRaceResultsTab from '../../components/profile/ProfileRaceResultsTab.jsx'
import './ProfileHubPages.css'

const ProfileRaceResultsPage = () => {
  return (
    <div className="profile-hub-page">
      <div className="container px-3 px-md-4 py-3 py-md-4">
        <ProfileRaceResultsTab />
      </div>
    </div>
  )
}

export default ProfileRaceResultsPage
