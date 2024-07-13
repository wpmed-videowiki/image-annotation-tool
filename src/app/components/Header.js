import { Language } from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  Stack,
  Toolbar,
  Typography,
  Container,
  Tooltip,
  MenuItem,
  Select,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { popupCenter } from "../utils/popupTools";
import { logoutPlatform } from "../actions/auth";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { SUPPORTED_LOCALE_LANGUAGES } from "../config/constants";
import { setLocaleToCookies } from "../actions/locale";

const Header = () => {
  const [anchorElUser, setAnchorElUser] = useState(null);

  const { data: session, update } = useSession();
  const t = useTranslations();
  const locale = useLocale();

  const onLocaleChange = async (locale) => {
    await setLocaleToCookies(locale);
    window.location.reload();
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const logout = async (provider) => {
    await logoutPlatform(provider);
    await update();
  };

  return (
    <AppBar position="fixed" sx={{ backgroundColor: "white" }}>
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          sx={{
            display: { md: "flex" },
            justifyContent: { md: "space-between" },
            mx: "auto",
          }}
        >
          <Stack
            sx={{
              display: { xs: "none", md: "flex" },
            }}
          >
            <Link href="/">
              <Stack direction="row" spacing={1} alignItems="center">
                <img src="/logo.png" width={200} height={57} />
              </Stack>
            </Link>
          </Stack>

          <Box sx={{ flexGrow: 0 }}>
            <Stack flexDirection="row" alignItems="center" gap={2}>
              <Select
                value={locale}
                onChange={(e) => {
                  console.log("e", e);
                  onLocaleChange(e.target.value);
                }}
                size="small"
                // sx={{ color: "white" }}
                renderValue={(value) => {
                  const lang = SUPPORTED_LOCALE_LANGUAGES.find(
                    (l) => l.code === value
                  );
                  if (!lang) {
                    return <Language />;
                  }
                  return (
                    <Stack
                      justifyContent="center"
                      alignItems="center"
                      flexDirection="row"
                      gap={1}
                    >
                      <Language />
                      <Typography>{lang.name}</Typography>
                    </Stack>
                  );
                }}
              >
                {SUPPORTED_LOCALE_LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </MenuItem>
                ))}
              </Select>
              <Tooltip title="Open settings">
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  <Avatar>{session?.user.name?.slice(0, 1)}</Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                sx={{ mt: "45px" }}
                id="menu-appbar"
                anchorEl={anchorElUser}
                anchorOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                open={Boolean(anchorElUser)}
                onClose={handleCloseUserMenu}
              >
                {session?.user.wikimediaId ? (
                  <MenuItem onClick={() => logout("wikimedia")}>
                    <Typography textAlign="center">
                      Wikimedia {t("logout")}
                    </Typography>
                  </MenuItem>
                ) : (
                  <MenuItem
                    onClick={() =>
                      popupCenter("/login?provider=wikimedia", "Login")
                    }
                  >
                    <Typography textAlign="center">
                      Wikimedia {t("login")}
                    </Typography>
                  </MenuItem>
                )}
                {session?.user.nccommonsId ? (
                  <MenuItem onClick={() => logout("nccommons")}>
                    <Typography textAlign="center">
                      NC Commons {t("logout")}
                    </Typography>
                  </MenuItem>
                ) : (
                  <MenuItem
                    onClick={() =>
                      popupCenter("/login?provider=nccommons", "Login")
                    }
                  >
                    <Typography textAlign="center">
                      NC Commons {t("login")}
                    </Typography>
                  </MenuItem>
                )}
                {session?.user.mdwikiId ? (
                  <MenuItem onClick={() => logout("mdwiki")}>
                    <Typography textAlign="center">
                      MD Wiki {t("logout")}
                    </Typography>
                  </MenuItem>
                ) : (
                  <MenuItem
                    onClick={() =>
                      popupCenter("/login?provider=mdwiki", "Login")
                    }
                  >
                    <Typography textAlign="center">
                      MD Wiki {t("login")}
                    </Typography>
                  </MenuItem>
                )}
              </Menu>
            </Stack>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;
