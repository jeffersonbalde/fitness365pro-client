import React from 'react'
import ProfileTransactionsTab from '../../components/profile/ProfileTransactionsTab.jsx'
import './ProfileHubPages.css'

const ProfileTransactionsPage = () => {
  return (
    <div className="profile-hub-page">
      <div className="container px-3 px-md-4 py-3 py-md-4">
        <ProfileTransactionsTab />
      </div>
    </div>
  )
}

export default ProfileTransactionsPage
