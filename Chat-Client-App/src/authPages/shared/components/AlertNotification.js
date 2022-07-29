import React, { useEffect } from "react";
import Alert from "@mui/material/Alert";
import { AlertTitle, Snackbar } from "@mui/material";
import  {useDispatch, useSelector} from 'react-redux'
import { getActions } from "../../../actions/alertActions";

const AlertNotification = ({showAlertMessage, closeAlertMessage, alertMessageContent}) => {
  const dispatch = useDispatch();
  const selector = useSelector(state=> state.alert);
  useEffect(()=>{
    getActions(dispatch)
  })
  
  return (
    <Snackbar
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      open={showAlertMessage}
      onClose={closeAlertMessage}
      autoHideDuration={6000}
    >
      <Alert severity="info">
        <AlertTitle>{alertMessageContent}</AlertTitle>
      </Alert>
    </Snackbar>
  );
};

export default AlertNotification;
