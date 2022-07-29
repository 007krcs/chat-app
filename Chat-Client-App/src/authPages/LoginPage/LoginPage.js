import React, {useState, useEffect} from 'react';
import AuthBox from '../shared/components/AuthBox';
import LoginPageFooter from './LoginPageFooter';
import LoginPageHeader from './LoginPageHeader';
import LoginPageInput from './LoginPageInput';
import { validateLoginForm } from '../shared/utils/validators';
import { useDispatch, useSelector } from 'react-redux';
import { getActions } from '../../actions/authActions';
import { login } from '../../api';
import { useNavigate } from 'react-router-dom';

const LoginPage = ()=> {
    const [mail, setMail] = useState('');
    const [password, setPassword] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    useEffect(()=>{
        setIsFormValid(validateLoginForm({mail, password}));
    }, [mail, password, setIsFormValid]);

    const handleLogin =()=> {
        
        const userDetails = {
            mail,
            password
        }
        dispatch(getActions(dispatch).login(userDetails, navigate));
    }

    return (
        <AuthBox>
            <LoginPageHeader/>
            <LoginPageInput
                mail={mail}
                setMail={setMail}
                password={password}
                setPassword={setPassword}
            />
            <LoginPageFooter isFormValid={isFormValid} handleLogin={handleLogin}/>
        </AuthBox>
    )
}

export default LoginPage;