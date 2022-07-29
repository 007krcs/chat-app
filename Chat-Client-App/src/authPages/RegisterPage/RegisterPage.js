import React, { useEffect, useState } from 'react';
import AuthBox from '../shared/components/AuthBox';
import { Typography } from '@mui/material';
import RegisterPanelInput from './RegisterPanelInput';
import RegisterPageFooter from './RegisterPageFooter';
import { validateRegisterForm } from '../shared/utils/validators';
import { useNavigate } from 'react-router-dom';
import { register } from '../../api';
import { getActions } from '../../actions/authActions'
import { useDispatch, useSelector } from 'react-redux';

const RegisterPage = ()=> {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [mail, setmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setusername] = useState('');

    const [isFormValid, setIsFormValid] = useState(false);

    const handleRegister=()=>{
        const userDetails = {
            mail,
            password,
            username
        }
        dispatch(getActions(dispatch).register(userDetails, navigate));
    }

    useEffect(()=>{
        setIsFormValid(validateRegisterForm(mail, password, username))
    }, [mail, password, username, setIsFormValid])
    return (
            <AuthBox>
                <Typography variant='h5' sx={{color: 'white'}}>
                    Create an account
                </Typography>
                <RegisterPanelInput
                    mail={mail}
                    setMail={setmail}
                    password={password}
                    setPassword={setPassword}
                    username={username}
                    setUsername={setusername}
                />
                <RegisterPageFooter
                    handleRegister={handleRegister}
                    isFormValid={isFormValid}
                />
            </AuthBox>
          )
}

export default RegisterPage;