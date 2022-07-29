import React from "react";
import CustomPrimaryButton from "../shared/components/CustomPrimaryButton";
import { RedirectInfo } from "../shared/components/RedirectInfo";
import { useNavigate } from 'react-router-dom';
import { Tooltip } from "@mui/material";

const getFormNotValidMessage = () => {
    return "Username should contains between 3 and 12 characters and password should contains between 6 and 15 chratcters"
}

const getFormValidMessage = ()=>{
    return "Press to register"
}

const RegisterPageFooter = ({ handleRegister, isFormValid }) => {
  const navigate = useNavigate();
  const redirectToRegisterPage =()=>{
    navigate('/login')
  }

  return (
    <>
    <Tooltip title={!isFormValid? getFormNotValidMessage() : getFormValidMessage()}>
      <div>
        <CustomPrimaryButton
          label="Register"
          disabled={isFormValid}
          additionalStyles={{ marginTop: "30px" }}
          onClick={handleRegister}
        />
      </div>
      </Tooltip>
      <RedirectInfo
        text={'Need an account?'}
        redirectText={'Create an account'}
        additionalStyles={{marginTop: '5px'}}
        redirectHandler={redirectToRegisterPage}
      />
    </>
  );
};

export default RegisterPageFooter;
