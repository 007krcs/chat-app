import React from 'react'
import { FiberManualRecord } from '@mui/icons-material';
import { Box } from '@mui/material'
const OnlineIndicator = () => {
  return (
    <Box
        sx={{
            color: '#3baffd',
            display: 'flex',
            alignItems: 'center',
            position: 'absolute',
            right: '5px'
        }}
    >
        <FiberManualRecord/>
        </Box>
  )
}

export default OnlineIndicator;