import { db } from './_admin.js';
import { recordExecution, recordActiveUser } from './_executionStats.js';
import { buildRemovedVaultGui } from './_removedVaultGui.js';

function isExecutorRequest(req) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (req.query.format === 'raw' || req.query.trackOnly === '1') return true;
    const accept = (req.headers.accept || '').toLowerCase();
    if (accept && !accept.includes('text/html') && (accept.includes('*/*') || accept.includes('text/plain'))) return true;
    return ua.includes('roblox') ||
           ua.includes('synapse') ||
           ua.includes('executor') ||
           ua.includes('script-ware') ||
           ua.includes('krnl') ||
           ua.includes('fluxus') ||
           ua.includes('electron') ||
           ua.includes('curl') ||
           ua === '';
}

export default async function handler(req, res) {
    const { id, key, userId, trackOnly } = req.query;

    if (!id) {
        return res.status(400).send('Error: Missing Vault ID');
    }

    if (trackOnly === '1') {
        if (!userId || !/^\d{1,20}$/.test(String(userId))) {
            return res.status(400).send('Error: Invalid player ID');
        }
        try {
            await recordActiveUser(userId);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(204).end();
        } catch (err) {
            return res.status(500).send('Error recording active player');
        }
    }

    // Real browser visitors get sent to the SECURED landing page instead of raw code.
    if (!isExecutorRequest(req)) {
        const keyParam = key ? `&key=${encodeURIComponent(key)}` : '';
        return res.redirect(302, `/vault.html?id=${encodeURIComponent(id)}${keyParam}`);
    }

    try {
        const docSnap = await db.collection("vaults").doc(id).get();

        if (!docSnap.exists) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(200).send(buildRemovedVaultGui());
        }

        const vaultData = docSnap.data();

        // GUI Mode: no key in the URL at all — send an in-game popup instead that
        // asks the player to type their key, then verifies it via /api/verify.
        if (vaultData.requireKey && vaultData.guiMode) {
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(200).send(buildGuiLoader(id, getOrigin(req), vaultData.guiAppearance, vaultData.title));
        }

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        if (!vaultData.requireKey) {
            if (typeof vaultData.code === 'string' && vaultData.code.trim()) {
                try { await recordExecution(db.collection('vaults').doc(String(id)), id, vaultData.title, userId); } catch (e) {}
            }
            if (typeof vaultData.code !== 'string' || !vaultData.code.trim()) {
                return res.status(200).send(vaultData.code);
            }
            const deliveredCode = userId
                ? vaultData.code
                : buildTrackedScript(id, getOrigin(req), vaultData.code);
            return res.status(200).send(deliveredCode);
        }

        // Key-in-URL mode: fast-fail on an obviously missing key, otherwise hand off
        // to a loader that identifies the player and asks /api/verify to do the real
        // checking (key match, expiry, termination, bans, IP lock, player limits).
        if (!key) {
            return res.status(403).send(`
error("[VoidedX] Invalid Key Provided!", 2)
            `);
        }

        return res.status(200).send(buildKeyLoader(id, key, getOrigin(req)));
    } catch (err) {
        return res.status(500).send(`Error loading script: ${err.message}`);
    }
}

function buildKeyLoader(id, key, origin) {
    const verifyBase = `${origin}/api/verify`;
    return `
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer

local ok, response = pcall(function()
    return game:HttpGet(
        "${verifyBase}?id=${encodeURIComponent(id)}" ..
        "&key=" .. HttpService:UrlEncode(${luaString(key)}) ..
        "&userId=" .. tostring(player.UserId) ..
        "&username=" .. HttpService:UrlEncode(player.Name)
    )
end)

if not ok then
    return error("[VoidedX] Could not reach the verification server. Try again.", 0)
end

local decodeOk, result = pcall(function() return HttpService:JSONDecode(response) end)
if not decodeOk or type(result) ~= "table" then
    return error("[VoidedX] Verification server returned a bad response.", 0)
end

if not result.ok then
    if result.code == "vault_removed" then
        ${buildRemovedVaultGui()}
        return
    end
    return error("[VoidedX] " .. tostring(result.message or "Access denied."), 0)
end

loadstring(result.code)()
`.trim();
}

function buildTrackedScript(id, origin, code) {
    const trackUrl = `${origin}/api/raw?id=${encodeURIComponent(id)}&trackOnly=1&userId=`;
    return `
local Players = game:GetService("Players")
local player = Players.LocalPlayer
if player then
    task.spawn(function()
        pcall(function()
            game:HttpGet(${luaString(trackUrl)} .. tostring(player.UserId))
        end)
    end)
end

local scriptChunk, compileError = loadstring(${luaString(code)})
if not scriptChunk then
    error("[VoidedX] " .. tostring(compileError), 0)
end
return scriptChunk()
`.trim();
}

function luaString(str) {
    const escaped = String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\0/g, '\\000');
    return `"${escaped}"`;
}

function getOrigin(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${proto}://${host}`;
}

function buildGuiLoader(id, origin, rawAppearance = {}, rawVaultName = '') {
    const verifyBase = `${origin}/api/verify`;
    const keyPageUrl = `${origin}/key.html?id=${id}`;
    const appearance = sanitizeGuiAppearance(rawAppearance);
    const vaultName = typeof rawVaultName === 'string'
        ? rawVaultName.replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').trim().slice(0, 64) || `Vault ${id}`
        : `Vault ${id}`;
    const savedKeyFile = `VoidedX_Key_${String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)}.txt`;
    const toRgb = hex => hex.match(/[a-f\d]{2}/gi).map(part => parseInt(part, 16));
    const [bgR, bgG, bgB] = toRgb(appearance.backgroundColor);
    const [accentR, accentG, accentB] = toRgb(appearance.accentColor);
    const [glowR, glowG, glowB] = toRgb(appearance.secondaryColor);
    const [textR, textG, textB] = toRgb(appearance.textColor);
    return `
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local player = Players.LocalPlayer
local savedKeyPath = ${luaString(savedKeyFile)}

local function readSavedKey()
    if type(readfile) ~= "function" then return nil end
    local ok, value = pcall(function()
        if type(isfile) == "function" and not isfile(savedKeyPath) then return nil end
        return readfile(savedKeyPath)
    end)
    if ok and type(value) == "string" and value ~= "" then return value end
    return nil
end

local function saveKeyLocally(key)
    if type(writefile) ~= "function" then return false end
    return pcall(function() writefile(savedKeyPath, key) end)
end

local function clearSavedKey()
    if type(delfile) == "function" then
        pcall(function() delfile(savedKeyPath) end)
    elseif type(writefile) == "function" then
        pcall(function() writefile(savedKeyPath, "") end)
    end
end

local function getGuiParent()
    local ok, hui = pcall(function() return gethui() end)
    if ok and hui then return hui end
    local ok2, cg = pcall(function() return game:GetService("CoreGui") end)
    if ok2 and cg then return cg end
    return player:WaitForChild("PlayerGui")
end

local guiParent = getGuiParent()
local oldStatusGui = guiParent:FindFirstChild("VoidedXKeyStatus")
if oldStatusGui then oldStatusGui:Destroy() end
local oldKeyGui = guiParent:FindFirstChild("VoidedXKeySystem")
if oldKeyGui then oldKeyGui:Destroy() end

local COL_BG = Color3.fromRGB(${bgR}, ${bgG}, ${bgB})
local COL_INPUT = Color3.fromRGB(22, 26, 36)
local COL_BORDER = Color3.fromRGB(33, 38, 53)
local COL_CYAN = Color3.fromRGB(${accentR}, ${accentG}, ${accentB})
local COL_ACCENT = Color3.fromRGB(${glowR}, ${glowG}, ${glowB})
local COL_TEXT = Color3.fromRGB(${textR}, ${textG}, ${textB})
local COL_MUTED = Color3.fromRGB(100, 116, 139)
local COL_RED = Color3.fromRGB(239, 68, 68)
local COL_GREEN = Color3.fromRGB(16, 185, 129)

local EASE_OUT = Enum.EasingStyle.Quint
local EASE_BACK = Enum.EasingStyle.Back

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "VoidedXKeySystem"
screenGui.ResetOnSpawn = false
screenGui.IgnoreGuiInset = true
screenGui.DisplayOrder = 999
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = guiParent

local overlay = Instance.new("Frame")
overlay.Size = UDim2.fromScale(1, 1)
overlay.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
overlay.BackgroundTransparency = 1
overlay.BorderSizePixel = 0
overlay.ZIndex = 1
overlay.Parent = screenGui
TweenService:Create(overlay, TweenInfo.new(0.35, EASE_OUT), { BackgroundTransparency = 0.45 }):Play()

local card = Instance.new("Frame")
card.AnchorPoint = Vector2.new(0.5, 0.5)
card.Position = UDim2.new(0.5, 0, 0.5, 0)
card.Size = UDim2.new(0.9, 0, 0, 0)
card.AutomaticSize = Enum.AutomaticSize.Y
card.BackgroundColor3 = COL_BG
card.BorderSizePixel = 0
card.ClipsDescendants = false
card.ZIndex = 2
card.Parent = screenGui

local cardConstraint = Instance.new("UISizeConstraint")
cardConstraint.MaxSize = Vector2.new(410, 10000)
cardConstraint.Parent = card

local cardCorner = Instance.new("UICorner")
cardCorner.CornerRadius = UDim.new(0, 20)
cardCorner.Parent = card

local cardStroke = Instance.new("UIStroke")
cardStroke.Color = COL_CYAN
cardStroke.Thickness = 1
cardStroke.Transparency = 0.6
cardStroke.Parent = card
local cardGradient = Instance.new("UIGradient")
cardGradient.Rotation = 90
cardGradient.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(255, 255, 255))
cardGradient.Parent = card

local uiScale = Instance.new("UIScale")
uiScale.Scale = 0.88
uiScale.Parent = card
card.Position = UDim2.new(0.5, 0, 0.5, 16)
card.BackgroundTransparency = 1
cardStroke.Transparency = 1
TweenService:Create(uiScale, TweenInfo.new(0.48, EASE_BACK), { Scale = 1 }):Play()
TweenService:Create(card, TweenInfo.new(0.42, EASE_OUT), {
    BackgroundTransparency = 0,
    Position = UDim2.new(0.5, 0, 0.5, 0)
}):Play()
TweenService:Create(cardStroke, TweenInfo.new(0.38, EASE_OUT), { Transparency = 0.6 }):Play()

local closeButton = Instance.new("TextButton")
closeButton.AnchorPoint = Vector2.new(1, 0)
closeButton.Position = UDim2.new(1, -12, 0, 14)
closeButton.Size = UDim2.new(0, 28, 0, 28)
closeButton.BackgroundColor3 = COL_INPUT
closeButton.BackgroundTransparency = 0.1
closeButton.Text = "×"
closeButton.TextColor3 = COL_MUTED
closeButton.TextSize = 20
closeButton.Font = Enum.Font.Gotham
closeButton.AutoButtonColor = false
closeButton.ZIndex = 5
closeButton.Parent = card
local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 9)
closeCorner.Parent = closeButton
local closeStroke = Instance.new("UIStroke")
closeStroke.Color = COL_BORDER
closeStroke.Transparency = 0.25
closeStroke.Parent = closeButton
local closeScale = Instance.new("UIScale")
closeScale.Parent = closeButton
closeButton.MouseEnter:Connect(function()
    TweenService:Create(closeScale, TweenInfo.new(0.14, EASE_OUT), { Scale = 1.08 }):Play()
    TweenService:Create(closeStroke, TweenInfo.new(0.14, EASE_OUT), { Color = COL_CYAN }):Play()
end)
closeButton.MouseLeave:Connect(function()
    TweenService:Create(closeScale, TweenInfo.new(0.14, EASE_OUT), { Scale = 1 }):Play()
    TweenService:Create(closeStroke, TweenInfo.new(0.14, EASE_OUT), { Color = COL_BORDER }):Play()
end)
closeButton.Activated:Connect(function()
    closeButton.Active = false
    TweenService:Create(uiScale, TweenInfo.new(0.18, EASE_OUT), { Scale = 0.94 }):Play()
    TweenService:Create(card, TweenInfo.new(0.22, EASE_OUT), {
        BackgroundTransparency = 1,
        Position = UDim2.new(0.5, 0, 0.5, 14)
    }):Play()
    TweenService:Create(cardStroke, TweenInfo.new(0.16, EASE_OUT), { Transparency = 1 }):Play()
    TweenService:Create(overlay, TweenInfo.new(0.2, EASE_OUT), { BackgroundTransparency = 1 }):Play()
    task.wait(0.2)
    if screenGui.Parent then screenGui:Destroy() end
end)

local accentBar = Instance.new("Frame")
accentBar.Position = UDim2.new(0, 18, 0, 1)
accentBar.Size = UDim2.new(1, -36, 0, 3)
accentBar.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
accentBar.BorderSizePixel = 0
accentBar.ZIndex = 3
accentBar.Parent = card
local accentCorner = Instance.new("UICorner")
accentCorner.CornerRadius = UDim.new(1, 0)
accentCorner.Parent = accentBar
local accentGradient = Instance.new("UIGradient")
accentGradient.Rotation = 0
accentGradient.Color = ColorSequence.new(COL_CYAN, COL_ACCENT)
accentGradient.Parent = accentBar

local content = Instance.new("Frame")
content.Size = UDim2.new(1, 0, 0, 0)
content.AutomaticSize = Enum.AutomaticSize.Y
content.Position = UDim2.new(0, 0, 0, 8)
content.BackgroundTransparency = 1
content.ZIndex = 2
content.Parent = card
TweenService:Create(content, TweenInfo.new(0.38, EASE_OUT, Enum.EasingDirection.Out, 0, false, 0.08), {
    Position = UDim2.new(0, 0, 0, 0)
}):Play()

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 20)
padding.PaddingBottom = UDim.new(0, 17)
padding.PaddingLeft = UDim.new(0, 20)
padding.PaddingRight = UDim.new(0, 20)
padding.Parent = content

local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 9)
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Parent = content

local eyebrow = Instance.new("TextLabel")
eyebrow.Size = UDim2.new(1, 0, 0, 13)
eyebrow.BackgroundTransparency = 1
eyebrow.Text = "S E C U R E   K E Y   A C C E S S"
eyebrow.TextColor3 = COL_CYAN
eyebrow.TextSize = 9
eyebrow.Font = Enum.Font.GothamBold
eyebrow.LayoutOrder = 1
eyebrow.Parent = content

local badge = Instance.new("Frame")
badge.Size = UDim2.new(0, 52, 0, 52)
badge.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
badge.BorderSizePixel = 0
badge.LayoutOrder = 2
badge.Parent = content
local badgeCorner = Instance.new("UICorner")
badgeCorner.CornerRadius = UDim.new(0, 12)
badgeCorner.Parent = badge
local badgeGradient = Instance.new("UIGradient")
badgeGradient.Rotation = 45
badgeGradient.Color = ColorSequence.new(COL_CYAN, COL_ACCENT)
badgeGradient.Parent = badge
local badgeScale = Instance.new("UIScale")
badgeScale.Parent = badge
TweenService:Create(badgeScale, TweenInfo.new(1.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Scale = 1.045 }):Play()
local badgeIcon = Instance.new("TextLabel")
badgeIcon.Size = UDim2.fromScale(1, 1)
badgeIcon.BackgroundTransparency = 1
badgeIcon.Text = "\\u{1F511}"
badgeIcon.TextScaled = true
badgeIcon.Font = Enum.Font.GothamBold
badgeIcon.Parent = badge

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 24)
title.BackgroundTransparency = 1
title.Text = ${luaString(appearance.title)}
title.TextColor3 = COL_TEXT
title.Font = Enum.Font.GothamBold
title.TextScaled = true
title.LayoutOrder = 3
title.Parent = content

local subtitle = Instance.new("TextLabel")
subtitle.Size = UDim2.new(1, 0, 0, 16)
subtitle.BackgroundTransparency = 1
subtitle.Text = ${luaString(appearance.subtitle)}
subtitle.TextColor3 = COL_MUTED
subtitle.Font = Enum.Font.Gotham
subtitle.TextScaled = true
subtitle.LayoutOrder = 4
subtitle.Parent = content

local vaultNameLabel = Instance.new("TextLabel")
vaultNameLabel.Size = UDim2.new(1, 0, 0, 18)
vaultNameLabel.BackgroundTransparency = 1
vaultNameLabel.Text = ${luaString(`Vault: ${vaultName}`)}
vaultNameLabel.TextColor3 = COL_CYAN
vaultNameLabel.Font = Enum.Font.GothamSemibold
vaultNameLabel.TextScaled = true
vaultNameLabel.TextWrapped = true
vaultNameLabel.LayoutOrder = 5
vaultNameLabel.Parent = content

local inputBox = Instance.new("TextBox")
inputBox.Size = UDim2.new(1, 0, 0, 44)
inputBox.BackgroundColor3 = COL_INPUT
inputBox.TextColor3 = COL_CYAN
inputBox.PlaceholderText = "Enter key here..."
inputBox.PlaceholderColor3 = COL_MUTED
inputBox.Text = ""
inputBox.ClearTextOnFocus = false
inputBox.Font = Enum.Font.Code
inputBox.TextSize = 13
inputBox.TextXAlignment = Enum.TextXAlignment.Left
inputBox.LayoutOrder = 4
inputBox.Parent = content
local inputCorner = Instance.new("UICorner")
inputCorner.CornerRadius = UDim.new(0, 10)
inputCorner.Parent = inputBox
local inputStroke = Instance.new("UIStroke")
inputStroke.Color = COL_CYAN
inputStroke.Transparency = 0.47
inputStroke.Thickness = 1
inputStroke.Parent = inputBox
local inputPad = Instance.new("UIPadding")
inputPad.PaddingLeft = UDim.new(0, 12)
inputPad.PaddingRight = UDim.new(0, 12)
inputPad.Parent = inputBox

inputBox.Focused:Connect(function()
    TweenService:Create(inputStroke, TweenInfo.new(0.2, EASE_OUT), { Color = COL_CYAN, Thickness = 2, Transparency = 0.18 }):Play()
end)
inputBox.FocusLost:Connect(function()
    TweenService:Create(inputStroke, TweenInfo.new(0.2, EASE_OUT), { Color = COL_CYAN, Thickness = 1, Transparency = 0.47 }):Play()
end)

local submitBtn = Instance.new("TextButton")
submitBtn.Size = UDim2.new(1, 0, 0, 46)
submitBtn.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
submitBtn.Text = ${luaString(appearance.buttonLabel)}
submitBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
submitBtn.Font = Enum.Font.GothamBold
submitBtn.TextSize = 13
submitBtn.TextXAlignment = Enum.TextXAlignment.Left
submitBtn.LayoutOrder = 5
submitBtn.AutoButtonColor = false
submitBtn.Parent = content
local submitPad = Instance.new("UIPadding")
submitPad.PaddingLeft = UDim.new(0, 14)
submitPad.PaddingRight = UDim.new(0, 46)
submitPad.Parent = submitBtn
local btnCorner = Instance.new("UICorner")
btnCorner.CornerRadius = UDim.new(0, 10)
btnCorner.Parent = submitBtn
local btnGradient = Instance.new("UIGradient")
btnGradient.Rotation = 45
btnGradient.Color = ColorSequence.new(COL_CYAN, COL_ACCENT)
btnGradient.Parent = submitBtn
local arrowBadge = Instance.new("Frame")
arrowBadge.AnchorPoint = Vector2.new(1, 0.5)
arrowBadge.Position = UDim2.new(1, -11, 0.5, 0)
arrowBadge.Size = UDim2.new(0, 25, 0, 25)
arrowBadge.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
arrowBadge.BackgroundTransparency = 0.82
arrowBadge.BorderSizePixel = 0
arrowBadge.Parent = submitBtn
local arrowBadgeCorner = Instance.new("UICorner")
arrowBadgeCorner.CornerRadius = UDim.new(0, 8)
arrowBadgeCorner.Parent = arrowBadge
local submitArrow = Instance.new("TextLabel")
submitArrow.Size = UDim2.fromScale(1, 1)
submitArrow.BackgroundTransparency = 1
submitArrow.Text = "→"
submitArrow.TextColor3 = Color3.fromRGB(255, 255, 255)
submitArrow.TextSize = 16
submitArrow.Font = Enum.Font.GothamBold
submitArrow.Parent = arrowBadge
local btnScale = Instance.new("UIScale")
btnScale.Parent = submitBtn

submitBtn.MouseEnter:Connect(function()
    TweenService:Create(btnScale, TweenInfo.new(0.15, EASE_OUT), { Scale = 1.02 }):Play()
end)
submitBtn.MouseLeave:Connect(function()
    TweenService:Create(btnScale, TweenInfo.new(0.15, EASE_OUT), { Scale = 1 }):Play()
end)
submitBtn.MouseButton1Down:Connect(function()
    TweenService:Create(btnScale, TweenInfo.new(0.1, EASE_OUT), { Scale = 0.97 }):Play()
end)
submitBtn.MouseButton1Up:Connect(function()
    TweenService:Create(btnScale, TweenInfo.new(0.1, EASE_OUT), { Scale = 1.02 }):Play()
end)

local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.new(1, 0, 0, 0)
statusLabel.AutomaticSize = Enum.AutomaticSize.Y
statusLabel.BackgroundTransparency = 1
statusLabel.Text = ""
statusLabel.TextColor3 = COL_RED
statusLabel.Font = Enum.Font.Gotham
statusLabel.TextSize = 11
statusLabel.TextWrapped = true
statusLabel.TextTransparency = 1
statusLabel.LayoutOrder = 6
statusLabel.Parent = content

local getKeyBtn = Instance.new("TextButton")
getKeyBtn.Size = UDim2.new(1, 0, 0, 36)
getKeyBtn.BackgroundColor3 = COL_INPUT
getKeyBtn.BackgroundTransparency = 0.12
getKeyBtn.Text = "↗   Need a key? Get one here"
getKeyBtn.TextColor3 = COL_TEXT
getKeyBtn.Font = Enum.Font.GothamSemibold
getKeyBtn.TextSize = 11
getKeyBtn.AutoButtonColor = false
getKeyBtn.LayoutOrder = 7
getKeyBtn.Parent = content
local getKeyCorner = Instance.new("UICorner")
getKeyCorner.CornerRadius = UDim.new(0, 9)
getKeyCorner.Parent = getKeyBtn
local getKeyStroke = Instance.new("UIStroke")
getKeyStroke.Color = COL_BORDER
getKeyStroke.Transparency = 0.2
getKeyStroke.Parent = getKeyBtn
local getKeyScale = Instance.new("UIScale")
getKeyScale.Parent = getKeyBtn
getKeyBtn.MouseEnter:Connect(function()
    TweenService:Create(getKeyScale, TweenInfo.new(0.14, EASE_OUT), { Scale = 1.015 }):Play()
    TweenService:Create(getKeyStroke, TweenInfo.new(0.14, EASE_OUT), { Color = COL_CYAN, Transparency = 0 }):Play()
end)
getKeyBtn.MouseLeave:Connect(function()
    TweenService:Create(getKeyScale, TweenInfo.new(0.14, EASE_OUT), { Scale = 1 }):Play()
    TweenService:Create(getKeyStroke, TweenInfo.new(0.14, EASE_OUT), { Color = COL_BORDER, Transparency = 0.2 }):Play()
end)

local header = Instance.new("Frame")
header.Size = UDim2.new(1, 0, 0, 56)
header.BackgroundTransparency = 1
header.LayoutOrder = 1
header.Parent = content
badge.Parent = header
badge.Position = UDim2.new(0, 0, 0, 4)
badge.Size = UDim2.new(0, 48, 0, 48)
eyebrow.Parent = header
eyebrow.Position = UDim2.new(0, 60, 0, 1)
eyebrow.Size = UDim2.new(1, -108, 0, 11)
eyebrow.Text = "SECURE KEY ACCESS"
eyebrow.TextXAlignment = Enum.TextXAlignment.Left
eyebrow.TextSize = 8
title.Parent = header
title.Position = UDim2.new(0, 60, 0, 13)
title.Size = UDim2.new(1, -108, 0, 23)
title.TextScaled = false
title.TextSize = 14
title.TextTruncate = Enum.TextTruncate.AtEnd
title.TextXAlignment = Enum.TextXAlignment.Left
subtitle.Parent = header
subtitle.Position = UDim2.new(0, 60, 0, 36)
subtitle.Size = UDim2.new(1, -108, 0, 15)
subtitle.TextScaled = false
subtitle.TextSize = 10
subtitle.TextTruncate = Enum.TextTruncate.AtEnd
subtitle.TextXAlignment = Enum.TextXAlignment.Left

local vaultPill = Instance.new("Frame")
vaultPill.Size = UDim2.new(1, 0, 0, 28)
vaultPill.BackgroundColor3 = COL_INPUT
vaultPill.BackgroundTransparency = 0.2
vaultPill.BorderSizePixel = 0
vaultPill.LayoutOrder = 2
vaultPill.Parent = content
local vaultPillCorner = Instance.new("UICorner")
vaultPillCorner.CornerRadius = UDim.new(0, 8)
vaultPillCorner.Parent = vaultPill
local vaultPillStroke = Instance.new("UIStroke")
vaultPillStroke.Color = COL_BORDER
vaultPillStroke.Transparency = 0.25
vaultPillStroke.Parent = vaultPill
local vaultDot = Instance.new("Frame")
vaultDot.Position = UDim2.new(0, 10, 0.5, -3)
vaultDot.Size = UDim2.new(0, 6, 0, 6)
vaultDot.BackgroundColor3 = COL_CYAN
vaultDot.BorderSizePixel = 0
vaultDot.Parent = vaultPill
local vaultDotCorner = Instance.new("UICorner")
vaultDotCorner.CornerRadius = UDim.new(1, 0)
vaultDotCorner.Parent = vaultDot
vaultNameLabel.Parent = vaultPill
vaultNameLabel.Position = UDim2.new(0, 23, 0, 0)
vaultNameLabel.Size = UDim2.new(1, -32, 1, 0)
vaultNameLabel.TextScaled = false
vaultNameLabel.TextSize = 10
vaultNameLabel.TextTruncate = Enum.TextTruncate.AtEnd
vaultNameLabel.TextXAlignment = Enum.TextXAlignment.Left
vaultNameLabel.TextYAlignment = Enum.TextYAlignment.Center

local inputCaption = Instance.new("TextLabel")
inputCaption.Size = UDim2.new(1, 0, 0, 11)
inputCaption.BackgroundTransparency = 1
inputCaption.Text = "ACCESS KEY"
inputCaption.TextColor3 = COL_MUTED
inputCaption.TextSize = 8
inputCaption.Font = Enum.Font.GothamBold
inputCaption.TextXAlignment = Enum.TextXAlignment.Left
inputCaption.LayoutOrder = 3
inputCaption.Parent = content

local footerLabel = Instance.new("TextLabel")
footerLabel.Size = UDim2.new(1, 0, 0, 10)
footerLabel.BackgroundTransparency = 1
footerLabel.Text = "VOIDEDX KEY ACCESS"
footerLabel.TextColor3 = COL_MUTED
footerLabel.TextSize = 8
footerLabel.Font = Enum.Font.GothamBold
footerLabel.LayoutOrder = 8
footerLabel.Parent = content

local introTexts = { eyebrow, badgeIcon, title, subtitle, vaultNameLabel, inputCaption, inputBox, submitBtn, submitArrow, getKeyBtn, footerLabel }
for _, textObject in ipairs(introTexts) do
    textObject.TextTransparency = 1
end
task.spawn(function()
    task.wait(0.12)
    for _, textObject in ipairs(introTexts) do
        if textObject.Parent then
            TweenService:Create(textObject, TweenInfo.new(0.2, EASE_OUT), { TextTransparency = 0 }):Play()
        end
        task.wait(0.045)
    end
end)

local function setStatus(text, color)
    statusLabel.Text = text
    statusLabel.TextColor3 = color
    if text == "" then
        statusLabel.TextTransparency = 1
    else
        statusLabel.TextTransparency = 1
        TweenService:Create(statusLabel, TweenInfo.new(0.18, EASE_OUT), { TextTransparency = 0 }):Play()
    end
end

local function formatKeyTime(seconds)
    seconds = math.max(0, math.floor(seconds))
    local days = math.floor(seconds / 86400)
    local hours = math.floor((seconds % 86400) / 3600)
    local minutes = math.floor((seconds % 3600) / 60)
    if days > 0 then return string.format("%dd %dh", days, hours) end
    if hours > 0 then return string.format("%dh %dm", hours, minutes) end
    if seconds < 60 then return string.format("%ds", seconds) end
    return string.format("%dm", minutes)
end

local function formatExpiryDate(expiresAtMs)
    local ok, value = pcall(function()
        return os.date("!%Y-%m-%d %H:%M UTC", math.floor(expiresAtMs / 1000))
    end)
    if ok and type(value) == "string" then return value end
    return "date unavailable"
end

local function showKeyTimer(remainingSeconds, fileSaved, expiresAtMs)
    screenGui.Name = "VoidedXKeyStatus"

    local camera = workspace.CurrentCamera
    local viewportWidth = camera and camera.ViewportSize.X or 360
    local panelWidth = math.max(220, math.min(310, viewportWidth - 28))
    local panel = Instance.new("Frame")
    panel.AnchorPoint = Vector2.new(1, 1)
    panel.Position = UDim2.new(1, -14, 1, 20)
    panel.Size = UDim2.new(0, panelWidth, 0, 82)
    panel.BackgroundColor3 = COL_BG
    panel.BackgroundTransparency = 1
    panel.BorderSizePixel = 0
    panel.Parent = screenGui
    local panelCorner = Instance.new("UICorner")
    panelCorner.CornerRadius = UDim.new(0, 10)
    panelCorner.Parent = panel
    local panelStroke = Instance.new("UIStroke")
    panelStroke.Color = COL_CYAN
    panelStroke.Transparency = 1
    panelStroke.Parent = panel
    local panelScale = Instance.new("UIScale")
    panelScale.Scale = 0.94
    panelScale.Parent = panel
    TweenService:Create(panel, TweenInfo.new(0.32, EASE_OUT), {
        Position = UDim2.new(1, -14, 1, -14),
        BackgroundTransparency = 0.08
    }):Play()
    TweenService:Create(panelStroke, TweenInfo.new(0.3, EASE_OUT), { Transparency = 0.35 }):Play()
    TweenService:Create(panelScale, TweenInfo.new(0.36, EASE_BACK), { Scale = 1 }):Play()

    local nameLabel = Instance.new("TextLabel")
    nameLabel.Position = UDim2.new(0, 11, 0, 6)
    nameLabel.Size = UDim2.new(1, -38, 0, 17)
    nameLabel.BackgroundTransparency = 1
    nameLabel.Text = ${luaString(vaultName)}
    nameLabel.TextColor3 = COL_TEXT
    nameLabel.Font = Enum.Font.GothamBold
    nameLabel.TextSize = 11
    nameLabel.TextXAlignment = Enum.TextXAlignment.Left
    nameLabel.TextTruncate = Enum.TextTruncate.AtEnd
    nameLabel.Parent = panel

    local timerLabel = Instance.new("TextLabel")
    timerLabel.Position = UDim2.new(0, 11, 0, 25)
    timerLabel.Size = UDim2.new(1, -24, 0, 16)
    timerLabel.BackgroundTransparency = 1
    timerLabel.TextColor3 = COL_CYAN
    timerLabel.Font = Enum.Font.Gotham
    timerLabel.TextSize = 10
    timerLabel.TextXAlignment = Enum.TextXAlignment.Left
    timerLabel.TextTruncate = Enum.TextTruncate.AtEnd
    timerLabel.Parent = panel

    local expiryLabel = Instance.new("TextLabel")
    expiryLabel.Position = UDim2.new(0, 11, 0, 42)
    expiryLabel.Size = UDim2.new(1, -22, 0, 14)
    expiryLabel.BackgroundTransparency = 1
    expiryLabel.TextColor3 = COL_MUTED
    expiryLabel.Font = Enum.Font.Gotham
    expiryLabel.TextSize = 9
    expiryLabel.TextXAlignment = Enum.TextXAlignment.Left
    expiryLabel.TextTruncate = Enum.TextTruncate.AtEnd
    expiryLabel.Parent = panel

    local fileLabel = Instance.new("TextLabel")
    fileLabel.Position = UDim2.new(0, 11, 0, 57)
    fileLabel.Size = UDim2.new(1, -22, 0, 14)
    fileLabel.BackgroundTransparency = 1
    fileLabel.TextColor3 = COL_MUTED
    fileLabel.Font = Enum.Font.Gotham
    fileLabel.TextSize = 9
    fileLabel.TextXAlignment = Enum.TextXAlignment.Left
    fileLabel.TextTruncate = Enum.TextTruncate.AtEnd
    fileLabel.Parent = panel

    expiryLabel.Text = type(expiresAtMs) == "number"
        and ("Expires: " .. formatExpiryDate(expiresAtMs))
        or "Expiry: Permanent"
    fileLabel.Text = fileSaved
        and ("Executor save file: " .. savedKeyPath)
        or "Save file unavailable (executor has no writefile support)"

    local closeButton = Instance.new("TextButton")
    closeButton.Position = UDim2.new(1, -27, 0, 5)
    closeButton.Size = UDim2.new(0, 22, 0, 22)
    closeButton.BackgroundTransparency = 1
    closeButton.Text = "×"
    closeButton.TextColor3 = COL_MUTED
    closeButton.TextSize = 18
    closeButton.Font = Enum.Font.GothamBold
    closeButton.Parent = panel
    closeButton.Activated:Connect(function()
        TweenService:Create(panel, TweenInfo.new(0.18, EASE_OUT), {
            Position = UDim2.new(1, -14, 1, 16),
            BackgroundTransparency = 1
        }):Play()
        TweenService:Create(panelStroke, TweenInfo.new(0.16, EASE_OUT), { Transparency = 1 }):Play()
        TweenService:Create(panelScale, TweenInfo.new(0.18, EASE_OUT), { Scale = 0.94 }):Play()
        task.wait(0.19)
        if screenGui.Parent then screenGui:Destroy() end
    end)

    if type(remainingSeconds) ~= "number" then
        timerLabel.Text = "Key is permanent"
        return
    end

    local secondsLeft = math.max(0, math.floor(remainingSeconds))
    task.spawn(function()
        while panel.Parent and secondsLeft > 0 do
            timerLabel.Text = "Key expires in " .. formatKeyTime(secondsLeft)
            task.wait(1)
            secondsLeft -= 1
        end
        if panel.Parent then
            clearSavedKey()
            timerLabel.Text = "Key expired · get a new key to run again"
            timerLabel.TextColor3 = COL_RED
            if fileSaved then fileLabel.Text = "Executor save file cleared after expiry" end
        end
    end)
end

local function shakeCard()
    local originalPos = card.Position
    local seq = {
        UDim2.new(originalPos.X.Scale, originalPos.X.Offset - 8, originalPos.Y.Scale, originalPos.Y.Offset),
        UDim2.new(originalPos.X.Scale, originalPos.X.Offset + 8, originalPos.Y.Scale, originalPos.Y.Offset),
        UDim2.new(originalPos.X.Scale, originalPos.X.Offset - 5, originalPos.Y.Scale, originalPos.Y.Offset),
        originalPos
    }
    for _, pos in ipairs(seq) do
        TweenService:Create(card, TweenInfo.new(0.06, Enum.EasingStyle.Linear), { Position = pos }):Play()
        task.wait(0.06)
    end
    local flashColor = cardStroke.Color
    cardStroke.Color = COL_RED
    TweenService:Create(cardStroke, TweenInfo.new(0.4, EASE_OUT), { Color = COL_CYAN }):Play()
end

getKeyBtn.Activated:Connect(function()
    TweenService:Create(getKeyScale, TweenInfo.new(0.09, EASE_OUT), { Scale = 0.97 }):Play()
    task.delay(0.1, function()
        if getKeyBtn.Parent then TweenService:Create(getKeyScale, TweenInfo.new(0.16, EASE_OUT), { Scale = 1 }):Play() end
    end)
    local copied = pcall(function() setclipboard(${luaString(keyPageUrl)}) end)
    if copied then
        setStatus("Link copied! Paste it in your browser.", COL_GREEN)
    else
        setStatus("Get a key at: ${keyPageUrl}", COL_MUTED)
    end
end)

local verifying = false
local dotsRunning = false

local function animateDots(label, baseText)
    dotsRunning = true
    task.spawn(function()
        local dots = 0
        while dotsRunning do
            label.Text = baseText .. string.rep(".", dots % 4)
            dots += 1
            task.wait(0.35)
        end
    end)
end

local function attemptVerify(fromSavedKey)
    if verifying then return end
    local typedKey = inputBox.Text
    if typedKey == "" then
        setStatus("Enter a key first.", COL_RED)
        shakeCard()
        return
    end

    verifying = true
    setStatus("", COL_MUTED)
    animateDots(submitBtn, "Verifying")

    local ok, response = pcall(function()
        return game:HttpGet(
            "${verifyBase}?id=${encodeURIComponent(id)}" ..
            "&key=" .. HttpService:UrlEncode(typedKey) ..
            "&userId=" .. tostring(player.UserId) ..
            "&username=" .. HttpService:UrlEncode(player.Name)
        )
    end)

    dotsRunning = false
    verifying = false
    submitBtn.Text = ${luaString(appearance.buttonLabel)}

    if not ok then
        setStatus("Couldn't reach the server. Try again.", COL_RED)
        shakeCard()
        return
    end

    local decodeOk, result = pcall(function() return HttpService:JSONDecode(response) end)
    if not decodeOk or type(result) ~= "table" then
        setStatus("Bad response from server.", COL_RED)
        shakeCard()
        return
    end

    if not result.ok then
        if result.code == "vault_removed" then
            screenGui:Destroy()
            ${buildRemovedVaultGui()}
            return
        end
        local failureMessage = tostring(result.message or "Invalid key.")
        if fromSavedKey then
            local lowerMessage = string.lower(failureMessage)
            local keyNeedsRenewal = string.find(lowerMessage, "invalid key", 1, true)
                or string.find(lowerMessage, "expired", 1, true)
                or string.find(lowerMessage, "terminated", 1, true)
            if keyNeedsRenewal then
                clearSavedKey()
                inputBox.Text = ""
                setStatus("Saved key expired or changed. Enter your current key.", COL_RED)
            else
                setStatus(failureMessage, COL_RED)
            end
        else
            setStatus(failureMessage, COL_RED)
        end
        shakeCard()
        return
    end

    local fileSaved = saveKeyLocally(typedKey)
    setStatus(fileSaved and "Key verified · saved on this device." or "Key verified · local file saving unavailable.", COL_GREEN)
    submitBtn.Text = "Success"
    submitBtn.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
    btnGradient.Color = ColorSequence.new(COL_GREEN, COL_CYAN)
    badgeGradient.Color = ColorSequence.new(COL_GREEN, COL_CYAN)
    TweenService:Create(uiScale, TweenInfo.new(0.15, EASE_OUT), { Scale = 1.04 }):Play()
    task.wait(0.15)
    TweenService:Create(uiScale, TweenInfo.new(0.25, EASE_OUT), { Scale = 0.9 }):Play()
    TweenService:Create(card, TweenInfo.new(0.25, EASE_OUT), {
        BackgroundTransparency = 1,
        Position = UDim2.new(0.5, 0, 0.5, 13)
    }):Play()
    TweenService:Create(cardStroke, TweenInfo.new(0.25, EASE_OUT), { Transparency = 1 }):Play()
    TweenService:Create(overlay, TweenInfo.new(0.3, EASE_OUT), { BackgroundTransparency = 1 }):Play()
    task.wait(0.25)

    card:Destroy()
    overlay:Destroy()
    showKeyTimer(result.remainingSeconds, fileSaved, result.expiresAt)
    loadstring(result.code)()
end

submitBtn.Activated:Connect(function()
    TweenService:Create(btnScale, TweenInfo.new(0.09, EASE_OUT), { Scale = 0.97 }):Play()
    task.delay(0.1, function()
        if submitBtn.Parent then TweenService:Create(btnScale, TweenInfo.new(0.16, EASE_OUT), { Scale = 1 }):Play() end
    end)
    attemptVerify()
end)
inputBox.FocusLost:Connect(function(enterPressed)
    if enterPressed then attemptVerify() end
end)

local previouslySavedKey = readSavedKey()
if previouslySavedKey then
    inputBox.Text = previouslySavedKey
    setStatus("Checking the saved key...", COL_MUTED)
    task.defer(function() attemptVerify(true) end)
end
`.trim();
}

function sanitizeGuiAppearance(raw = {}) {
    if (!raw || typeof raw !== 'object') raw = {};
    const text = (value, fallback, maxLength) => typeof value === 'string'
        ? value.replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').trim().slice(0, maxLength) || fallback
        : fallback;
    const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
        ? value
        : fallback;
    return {
        title: text(raw.title, 'VoidedX Key System', 40),
        subtitle: text(raw.subtitle, 'Enter your key to continue', 64),
        buttonLabel: text(raw.buttonLabel, 'Submit', 20),
        accentColor: color(raw.accentColor, '#06b6d4'),
        secondaryColor: color(raw.secondaryColor, '#6366f1'),
        backgroundColor: color(raw.backgroundColor, '#0b0d12'),
        textColor: color(raw.textColor, '#f8fafc')
    };
}
