import React from 'react'
import ProfileMembersTab from '../../components/profile/ProfileMembersTab.jsx'
import './ProfileHubPages.css'

const ProfileMembersPage = () => {
  return (
    <div className="profile-hub-page">
      <div className="container px-3 px-md-4 py-3 py-md-4">
        <ProfileMembersTab />
      </div>
    </div>
  )
}

export default ProfileMembersPage
