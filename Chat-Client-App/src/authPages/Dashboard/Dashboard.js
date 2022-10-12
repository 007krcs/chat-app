import React, { useEffect } from 'react';
import { styled } from '@mui/system';
import SideBar from './SideBar/SideBar';
import FriendsSideBar from './FriendsSideBar/FriendsSideBar';
import Messenger from './Messenger/Messenger';
import AppBar from './AppBar/AppBar';
import { logOut } from '../shared/utils/authLog';
import { connect } from 'react-redux';
import { getActions } from '../../actions/authActions';
import { connectWithSocketServer } from '../../realtimeCommunication/socketConnection';

const Wrapper = styled('div')({
    width: '100%',
    height: '100vh',
    display: 'flex'
})

const Dashboard = ({ setUserDetails })=> {
    useEffect(()=>{
        const userDetails = localStorage.getItem('user');
        if(!userDetails){
            logOut();
        } else {
            setUserDetails(JSON.parse(userDetails));
            connectWithSocketServer(JSON.parse(userDetails));
        }
    }, [])

    return (
    <Wrapper>
        <SideBar/>
        <FriendsSideBar/>
        <Messenger/>
        <AppBar/>
    </Wrapper>
    )
}

const mapActionsToProps =(dispatch)=> {
    return {
        ...getActions(dispatch)
    }
}

export default connect(null, mapActionsToProps)(Dashboard);