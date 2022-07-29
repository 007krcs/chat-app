import React from "react";
import { Typography } from "@mui/material";
import styled from "@emotion/styled";

const RedirectText = styled("span")({
  color: "red",
  fontWeight: 500,
  cursor: "pointer",
});
export const RedirectInfo = ({
  text,
  redirectText,
  additionalStyles,
  redirectHandler,
}) => {
  return (
    <Typography
      sx={{ color: "#7D7D7D" }}
      style={additionalStyles ? additionalStyles : {}}
      variant="subtitle2"
    >
      {text}
      <RedirectText onClick={redirectHandler}>{redirectText}</RedirectText>
    </Typography>
  );
};
