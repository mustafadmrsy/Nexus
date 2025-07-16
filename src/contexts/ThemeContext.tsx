import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeContextProvider');
  }
  return context;
};

interface ThemeContextProviderProps {
  children: React.ReactNode;
}

export const ThemeContextProvider: React.FC<ThemeContextProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // Body background color'ını güncelle
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const root = document.getElementById('root');
    
    if (isDarkMode) {
      body.style.backgroundColor = '#36393f';
      html.style.backgroundColor = '#36393f';
      if (root) root.style.backgroundColor = '#36393f';
    } else {
      body.style.backgroundColor = '#ffffff';
      html.style.backgroundColor = '#ffffff';
      if (root) root.style.backgroundColor = '#ffffff';
    }
  }, [isDarkMode]);

  const theme = createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#5865f2',
        dark: '#4752c4',
        light: '#7289da',
      },
      secondary: {
        main: '#57f287',
        dark: '#43b581',
        light: '#57f287',
      },
      background: {
        default: isDarkMode ? '#36393f' : '#ffffff',
        paper: isDarkMode ? '#2f3136' : '#f5f5f5',
      },
      text: {
        primary: isDarkMode ? '#ffffff' : '#000000',
        secondary: isDarkMode ? '#b9bbbe' : '#666666',
      },
      error: {
        main: '#f04747',
        dark: '#d73627',
        light: '#f66565',
      },
      warning: {
        main: '#faa61a',
        dark: '#e89611',
        light: '#fbb03b',
      },
      info: {
        main: '#7289da',
        dark: '#5b6ecd',
        light: '#8da4e6',
      },
      success: {
        main: '#43b581',
        dark: '#369868',
        light: '#5bc490',
      },
    },
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            backgroundColor: isDarkMode ? '#36393f' : '#ffffff',
            minHeight: '100vh',
          },
          body: {
            backgroundColor: isDarkMode ? '#36393f' : '#ffffff',
            minHeight: '100vh',
            color: isDarkMode ? '#ffffff' : '#000000',
            scrollbarWidth: 'thin',
            scrollbarColor: isDarkMode ? '#202225 #2f3136' : '#cccccc #f5f5f5',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: isDarkMode ? '#2f3136' : '#f5f5f5',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDarkMode ? '#202225' : '#cccccc',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: isDarkMode ? '#1a1c1f' : '#999999',
              },
            },
          },
          '#root': {
            backgroundColor: isDarkMode ? '#36393f' : '#ffffff',
            minHeight: '100vh',
          },
          '*': {
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: isDarkMode ? '#2f3136' : '#f5f5f5',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDarkMode ? '#202225' : '#cccccc',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: isDarkMode ? '#1a1c1f' : '#999999',
              },
            },
          },
        },
      },
      // Paper component için özel stiller
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: isDarkMode ? '#2f3136' : '#f5f5f5',
            color: isDarkMode ? '#ffffff' : '#000000',
          },
        },
      },
      // AppBar component için özel stiller
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDarkMode ? '#2f3136' : '#f5f5f5',
            color: isDarkMode ? '#ffffff' : '#000000',
          },
        },
      },
      // Drawer component için özel stiller
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDarkMode ? '#2f3136' : '#f5f5f5',
            color: isDarkMode ? '#ffffff' : '#000000',
          },
        },
      },
      // Menu component için özel stiller
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: isDarkMode ? '#18191c' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
          },
        },
      },
      // Dialog component için özel stiller
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
          },
        },
      },
      // Card component için özel stiller
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
          },
        },
      },
      // TextField component için özel stiller
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: isDarkMode ? '#40444b' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#000000',
              '& fieldset': {
                borderColor: isDarkMode ? '#292b2f' : '#e0e0e0',
              },
              '&:hover fieldset': {
                borderColor: isDarkMode ? '#5865f2' : '#5865f2',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#5865f2',
              },
            },
            '& .MuiInputLabel-root': {
              color: isDarkMode ? '#b9bbbe' : '#666666',
              '&.Mui-focused': {
                color: '#5865f2',
              },
            },
          },
        },
      },
    },
  });

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}; 