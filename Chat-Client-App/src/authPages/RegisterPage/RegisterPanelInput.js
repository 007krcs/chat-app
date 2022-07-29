import React from 'react'
import InputWithLabel from '../shared/components/InputWithLabel';


export const RegisterPanelInput = (props) => {
  const { mail, setMail, username, setUsername, password, setPassword } = props;


  return (
    <>
        <InputWithLabel
            value={mail}
            setValue={setMail}
            label="E-mail Address"
            type="email"
            placeholder="Enter e-mail address"
        />
        <InputWithLabel
            value={username}
            setValue={setUsername}
            label="User Name"
            type="text"
            placeholder="Enter Your User Name"
        />
        <InputWithLabel
            value={password}
            setValue={setPassword}
            label="Password"
            type="password"
            placeholder="Enter your password"
        />
    </>
  )
}

export default RegisterPanelInput;