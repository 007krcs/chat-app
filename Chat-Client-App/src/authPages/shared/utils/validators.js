export const validateLoginForm = ({mail, password})=>{
    const isMailValid = validateMail(mail);
    const isPasswordValid = validatePassword(password);
}

export const validateRegisterForm = ({mail, password, username})=>{
    return validateMail(mail) && validatePassword(password) && isUsername(username);
}

const validatePassword=(password)=>{
    return password.length > 6 && password.length < 12
}

const validateMail=(mail)=>{
    return String(mail)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
}

const isUsername=(username)=>{
    return username.length> 3 && username.length <13
}