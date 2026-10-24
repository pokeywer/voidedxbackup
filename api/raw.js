import { randomBytes } from 'node:crypto';
import { db } from './_admin.js';
import { recordActiveUser } from './_executionStats.js';
import { buildRemovedVaultGui } from './_removedVaultGui.js';
import { getCodeForExecution } from './_deliveryCode.js';
import { verifyLoaderToken } from './_loaderToken.js';

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
    const id = String(req.query.id || '');
    const key = String(req.query.key || '');
    const userId = req.query.userId;
    const trackOnly = req.query.trackOnly;
    const loaderToken = String(req.query.token || '');

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

    if (!verifyLoaderToken(loaderToken, id, key)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(410).send('error("[VoidedX] This loader expired. Copy the latest loader from the website and run it again.", 0)');
    }

    try {
        const docSnap = await db.collection("vaults").doc(id).get();

        if (!docSnap.exists) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(200).send(buildRemovedVaultGui());
        }

        const vaultData = docSnap.data();

        if (!verifyLoaderToken(loaderToken, id, key, vaultData.loaderVersion)) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(410).send('error("[VoidedX] This loader is no longer valid. Copy the latest loader from the website and run it again.", 0)');
        }

        if (vaultData.launchPaused === true) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(423).send('error("[VoidedX] This vault is temporarily paused by its owner.", 0)');
        }

        // GUI Mode: no key in the URL at all — send an in-game popup instead that
        // asks the player to type their key, then verifies it via /api/verify.
        if (vaultData.requireKey && vaultData.guiMode) {
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(200).send(buildGuiLoader(id, getOrigin(req), vaultData.guiAppearance, vaultData.title));
        }

        const executionCode = getCodeForExecution(vaultData);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        if (!vaultData.requireKey) {
            if (typeof executionCode !== 'string' || !executionCode.trim()) {
                return res.status(200).send(executionCode);
            }
            return res.status(200).send(buildTrackedScript(id, getOrigin(req)));
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
    return packGeneratedLoader(compactGeneratedLoader(`
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer
${buildPayloadRuntime(origin)}

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

return vxRunPayload(result.token, player and player.UserId or nil)
`));
}

function buildTrackedScript(id, origin) {
    const verifyUrl = `${origin}/api/verify?id=${encodeURIComponent(id)}`;
    return packGeneratedLoader(compactGeneratedLoader(`
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer
${buildPayloadRuntime(origin)}
local verifyUrl = ${luaString(verifyUrl)}
if player then verifyUrl = verifyUrl .. "&userId=" .. HttpService:UrlEncode(tostring(player.UserId)) end

local requestOk, response = pcall(function()
    return game:HttpGet(verifyUrl)
end)
if not requestOk then
    error("[VoidedX] Could not reach the loader server: " .. tostring(response), 0)
end
local decodeOk, result = pcall(function() return HttpService:JSONDecode(response) end)
if not decodeOk or type(result) ~= "table" then
    error("[VoidedX] Verification server returned a bad response.", 0)
end
if not result.ok then
    if result.code == "vault_removed" then
        ${buildRemovedVaultGui()}
        return
    end
    error("[VoidedX] " .. tostring(result.message or "Could not load the script."), 0)
end
return vxRunPayload(result.token, player and player.UserId or nil)
`));
}

function buildPayloadRuntime(origin) {
    const payloadBase = luaString(`${origin}/api/payload?session=`);
    return `
local function vxRunPayload(token, userId)
    if type(token) ~= "string" or token == "" then
        return error("[VoidedX] The server did not issue a delivery ticket.", 0)
    end
    local payloadUrl = ${payloadBase} .. HttpService:UrlEncode(token)
    if userId ~= nil then payloadUrl = payloadUrl .. "&userId=" .. HttpService:UrlEncode(tostring(userId)) end

    local requestOk, response = pcall(function() return game:HttpGet(payloadUrl) end)
    if not requestOk then
        return error("[VoidedX] Could not download the script: " .. tostring(response), 0)
    end
    local decodeOk, result = pcall(function() return HttpService:JSONDecode(response) end)
    if not decodeOk or type(result) ~= "table" then
        return error("[VoidedX] The payload server returned a bad response.", 0)
    end
    if not result.ok or type(result.code) ~= "string" then
        return error("[VoidedX] " .. tostring(result.message or "The script could not be delivered."), 0)
    end
    local scriptChunk, compileError = loadstring(result.code)
    if not scriptChunk then
        return error("[VoidedX] " .. tostring(compileError), 0)
    end
    return scriptChunk()
end
`.trim();
}

// Return a compact transport copy; this is cosmetic and does not replace the
// server-side ticket and key checks that protect delivery.
function compactGeneratedLoader(source) {
    let output = '';
    let index = 0;
    let needsSpace = false;

    const append = value => {
        if (needsSpace && output && !output.endsWith(' ')) output += ' ';
        output += value;
        needsSpace = false;
    };
    const longBracket = start => {
        if (source[start] !== '[') return null;
        let cursor = start + 1;
        while (source[cursor] === '=') cursor++;
        if (source[cursor] !== '[') return null;
        return { contentStart: cursor + 1, close: `]${'='.repeat(cursor - start - 1)}]` };
    };

    while (index < source.length) {
        const char = source[index];
        if (/\s/.test(char)) {
            needsSpace = true;
            index++;
            continue;
        }

        if (char === '-' && source[index + 1] === '-') {
            needsSpace = true;
            const bracket = longBracket(index + 2);
            if (bracket) {
                const closeIndex = source.indexOf(bracket.close, bracket.contentStart);
                index = closeIndex < 0 ? source.length : closeIndex + bracket.close.length;
            } else {
                while (index < source.length && source[index] !== '\n') index++;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            const quote = char;
            let end = index + 1;
            while (end < source.length) {
                if (source[end] === '\\') { end += 2; continue; }
                if (source[end++] === quote) break;
            }
            append(source.slice(index, end));
            index = end;
            continue;
        }

        const bracket = longBracket(index);
        if (bracket) {
            const closeIndex = source.indexOf(bracket.close, bracket.contentStart);
            const end = closeIndex < 0 ? source.length : closeIndex + bracket.close.length;
            append(source.slice(index, end));
            index = end;
            continue;
        }

        append(char);
        index++;
    }

    return output.trim();
}

function packGeneratedLoader(source) {
    const mask = randomBytes(1)[0] || 1;
    const encoded = Array.from(Buffer.from(source, 'utf8'), byte => {
        const maskedByte = (byte + mask) & 0xff;
        return `\\${String(maskedByte).padStart(3, '0')}`;
    }).join('');
    return `local _bsdata0={1,${mask},"${encoded}"};local _bsdata1={};for _i0=1,#_bsdata0[3] do _bsdata1[_i0]=string.char((string.byte(_bsdata0[3],_i0)-_bsdata0[2])%256) end;return assert(loadstring(table.concat(_bsdata1)))()`;
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
    const colorLuminance = hex => {
        const channels = toRgb(hex).map(value => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const buttonTextColor = (colorLuminance(appearance.accentColor) + colorLuminance(appearance.secondaryColor)) / 2 >= 0.18
        ? [17, 24, 39]
        : [248, 250, 252];
    const backgroundAnimation = appearance.backgroundAnimation;
    return packGeneratedLoader(compactGeneratedLoader(`
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local player = Players.LocalPlayer
local savedKeyPath = ${luaString(savedKeyFile)}
${buildPayloadRuntime(origin)}

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
local COL_MUTED = COL_TEXT:Lerp(COL_BG, 0.28)
local COL_RED = Color3.fromRGB(239, 68, 68)
local COL_GREEN = Color3.fromRGB(16, 185, 129)
local BACKGROUND_ANIMATION = ${luaString(backgroundAnimation)}

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
card.BackgroundTransparency = 0
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
local ambientGlows = {}
local animationLayer
if BACKGROUND_ANIMATION ~= "none" then
    animationLayer = Instance.new("Frame")
    animationLayer.Name = "VoidedXAnimatedBackground"
    animationLayer.Size = UDim2.fromScale(1, 1)
    animationLayer.BackgroundTransparency = 1
    animationLayer.BorderSizePixel = 0
    animationLayer.ClipsDescendants = true
    animationLayer.ZIndex = 2
    animationLayer.Parent = card
    local animationCorner = Instance.new("UICorner")
    animationCorner.CornerRadius = UDim.new(0, 20)
    animationCorner.Parent = animationLayer

    local function makeGlow(name, color, position, size, transparency)
        local glow = Instance.new("Frame")
        glow.Name = name
        glow.Position = position
        glow.Size = size
        glow.BackgroundColor3 = color
        glow.BackgroundTransparency = transparency or 0.72
        glow.BorderSizePixel = 0
        glow.ZIndex = 2
        glow.Parent = animationLayer
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(1, 0)
        corner.Parent = glow
        local gradient = Instance.new("UIGradient")
        gradient.Color = ColorSequence.new(color, COL_ACCENT)
        gradient.Transparency = NumberSequence.new({
            NumberSequenceKeypoint.new(0, 1),
            NumberSequenceKeypoint.new(0.5, 0.18),
            NumberSequenceKeypoint.new(1, 1)
        })
        gradient.Parent = glow
        table.insert(ambientGlows, glow)
        return glow, gradient
    end

    local firstGlow, firstGlowGradient = makeGlow("VoidedXAmbientGlowA", COL_CYAN, UDim2.new(-0.04, 0, 0.02, 0), UDim2.new(0.64, 0, 0.52, 0))
    local secondGlow, secondGlowGradient = makeGlow("VoidedXAmbientGlowB", COL_ACCENT, UDim2.new(0.42, 0, 0.42, 0), UDim2.new(0.62, 0, 0.5, 0))
    local function animateGlow(glow, gradient, duration, endPosition, endSize)
        TweenService:Create(glow, TweenInfo.new(duration, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
            Position = endPosition,
            Size = endSize
        }):Play()
        TweenService:Create(gradient, TweenInfo.new(duration * 1.4, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1), {
            Rotation = 180
        }):Play()
    end

    if BACKGROUND_ANIMATION == "orbit" then
        local function orbitGlow(glow, points, duration)
            task.spawn(function()
                local pointIndex = 1
                while animationLayer.Parent do
                    pointIndex = pointIndex % #points + 1
                    local tween = TweenService:Create(glow, TweenInfo.new(duration, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), {
                        Position = points[pointIndex]
                    })
                    tween:Play()
                    tween.Completed:Wait()
                end
            end)
        end
        orbitGlow(firstGlow, {
            UDim2.new(0.38, 0, 0.02, 0), UDim2.new(0.42, 0, 0.36, 0),
            UDim2.new(0.02, 0, 0.4, 0), UDim2.new(-0.04, 0, 0.02, 0)
        }, 4.2)
        orbitGlow(secondGlow, {
            UDim2.new(0.22, 0, 0.46, 0), UDim2.new(0.03, 0, 0.1, 0),
            UDim2.new(0.42, 0, 0.06, 0), UDim2.new(0.42, 0, 0.42, 0)
        }, 5.1)
    elseif BACKGROUND_ANIMATION == "nebula" then
        animateGlow(firstGlow, firstGlowGradient, 8.5, UDim2.new(0.18, 0, 0.16, 0), UDim2.new(0.78, 0, 0.64, 0))
        animateGlow(secondGlow, secondGlowGradient, 10.5, UDim2.new(0.18, 0, 0.3, 0), UDim2.new(0.74, 0, 0.62, 0))
        TweenService:Create(cardStroke, TweenInfo.new(3.8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Transparency = 0.32 }):Play()
    elseif BACKGROUND_ANIMATION == "drift" then
        animateGlow(firstGlow, firstGlowGradient, 7.5, UDim2.new(0.3, 0, 0.22, 0), UDim2.new(0.72, 0, 0.56, 0))
        animateGlow(secondGlow, secondGlowGradient, 9, UDim2.new(0.04, 0, 0.34, 0), UDim2.new(0.68, 0, 0.54, 0))
    elseif BACKGROUND_ANIMATION == "aurora" then
        animateGlow(firstGlow, firstGlowGradient, 12, UDim2.new(0.18, 0, 0.28, 0), UDim2.new(0.78, 0, 0.6, 0))
        animateGlow(secondGlow, secondGlowGradient, 10.5, UDim2.new(0.14, 0, 0.12, 0), UDim2.new(0.7, 0, 0.54, 0))
        TweenService:Create(cardStroke, TweenInfo.new(4.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Transparency = 0.4 }):Play()
    elseif BACKGROUND_ANIMATION == "pulse" then
        TweenService:Create(firstGlow, TweenInfo.new(2.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
            BackgroundTransparency = 0.42,
            Size = UDim2.new(0.78, 0, 0.62, 0)
        }):Play()
        TweenService:Create(secondGlow, TweenInfo.new(3, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
            BackgroundTransparency = 0.5,
            Position = UDim2.new(0.38, 0, 0.36, 0)
        }):Play()
    elseif BACKGROUND_ANIMATION == "waves" then
        for index = 1, 3 do
            local ribbon = Instance.new("Frame")
            ribbon.Name = "VoidedXWave" .. tostring(index)
            ribbon.Position = UDim2.new(-0.2, 0, 0.18 + index * 0.2, 0)
            ribbon.Size = UDim2.new(1.4, 0, 0, 20 + index * 5)
            ribbon.Rotation = -8
            ribbon.BackgroundColor3 = index % 2 == 0 and COL_ACCENT or COL_CYAN
            ribbon.BackgroundTransparency = 0.78
            ribbon.BorderSizePixel = 0
            ribbon.ZIndex = 2
            ribbon.Parent = animationLayer
            local gradient = Instance.new("UIGradient")
            gradient.Color = ColorSequence.new(COL_CYAN, COL_ACCENT)
            gradient.Transparency = NumberSequence.new({
                NumberSequenceKeypoint.new(0, 1),
                NumberSequenceKeypoint.new(0.5, 0.12),
                NumberSequenceKeypoint.new(1, 1)
            })
            gradient.Parent = ribbon
            TweenService:Create(ribbon, TweenInfo.new(3.8 + index * 0.65, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
                Position = UDim2.new(-0.08, 0, 0.08 + index * 0.2, 0),
                Rotation = 8
            }):Play()
        end
    elseif BACKGROUND_ANIMATION == "scanline" or BACKGROUND_ANIMATION == "grid" then
        if BACKGROUND_ANIMATION == "grid" then
            for index = 1, 4 do
                local horizontal = Instance.new("Frame")
                horizontal.Position = UDim2.new(0, 0, index * 0.2, 0)
                horizontal.Size = UDim2.new(1, 0, 0, 1)
                horizontal.BackgroundColor3 = COL_CYAN
                horizontal.BackgroundTransparency = 0.78
                horizontal.BorderSizePixel = 0
                horizontal.ZIndex = 2
                horizontal.Parent = animationLayer
            end
            for index = 1, 5 do
                local vertical = Instance.new("Frame")
                vertical.Position = UDim2.new(index * 0.16, 0, 0, 0)
                vertical.Size = UDim2.new(0, 1, 1, 0)
                vertical.BackgroundColor3 = COL_ACCENT
                vertical.BackgroundTransparency = 0.82
                vertical.BorderSizePixel = 0
                vertical.ZIndex = 2
                vertical.Parent = animationLayer
            end
        end
        local scan = Instance.new("Frame")
        scan.Name = "VoidedXScanline"
        scan.Position = UDim2.new(0, 0, -0.12, 0)
        scan.Size = UDim2.new(1, 0, 0, BACKGROUND_ANIMATION == "grid" and 3 or 5)
        scan.BackgroundColor3 = COL_CYAN
        scan.BackgroundTransparency = 0.45
        scan.BorderSizePixel = 0
        scan.ZIndex = 2
        scan.Parent = animationLayer
        local scanGradient = Instance.new("UIGradient")
        scanGradient.Color = ColorSequence.new(COL_CYAN, COL_ACCENT)
        scanGradient.Transparency = NumberSequence.new({
            NumberSequenceKeypoint.new(0, 0.45),
            NumberSequenceKeypoint.new(0.5, 0.08),
            NumberSequenceKeypoint.new(1, 0.45)
        })
        scanGradient.Parent = scan
        TweenService:Create(scan, TweenInfo.new(BACKGROUND_ANIMATION == "grid" and 5.5 or 3.2, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1), {
            Position = UDim2.new(0, 0, 1.04, 0)
        }):Play()
    elseif BACKGROUND_ANIMATION == "starlight" or BACKGROUND_ANIMATION == "particles" then
        local points = {
            { 0.07, 0.18 }, { 0.18, 0.73 }, { 0.3, 0.3 }, { 0.44, 0.84 },
            { 0.58, 0.16 }, { 0.72, 0.62 }, { 0.86, 0.28 }, { 0.94, 0.8 }
        }
        for index, point in ipairs(points) do
            local dot = Instance.new("Frame")
            dot.Name = (BACKGROUND_ANIMATION == "starlight" and "VoidedXStar" or "VoidedXParticle") .. tostring(index)
            dot.Position = UDim2.new(point[1], 0, point[2], 0)
            local diameter = BACKGROUND_ANIMATION == "starlight" and (index % 3 == 0 and 5 or 3) or (index % 2 == 0 and 5 or 4)
            dot.Size = UDim2.new(0, diameter, 0, diameter)
            dot.BackgroundColor3 = index % 2 == 0 and COL_ACCENT or COL_CYAN
            dot.BackgroundTransparency = 0.18
            dot.BorderSizePixel = 0
            dot.ZIndex = 2
            dot.Parent = animationLayer
            local dotCorner = Instance.new("UICorner")
            dotCorner.CornerRadius = UDim.new(1, 0)
            dotCorner.Parent = dot
            local duration = BACKGROUND_ANIMATION == "starlight" and (1.2 + (index % 4) * 0.45) or (2.4 + (index % 4) * 0.5)
            local offsetX = index % 2 == 0 and 0.035 or -0.035
            local offsetY = index % 2 == 0 and -0.09 or 0.09
            TweenService:Create(dot, TweenInfo.new(duration, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
                Position = UDim2.new(math.clamp(point[1] + offsetX, 0.02, 0.96), 0, math.clamp(point[2] + offsetY, 0.04, 0.92), 0),
                BackgroundTransparency = BACKGROUND_ANIMATION == "starlight" and 0.82 or 0.62
            }):Play()
        end
    elseif BACKGROUND_ANIMATION == "shimmer" or BACKGROUND_ANIMATION == "comet" then
        local streak = Instance.new("Frame")
        streak.Name = BACKGROUND_ANIMATION == "comet" and "VoidedXComet" or "VoidedXShimmer"
        streak.Position = UDim2.new(-0.55, 0, BACKGROUND_ANIMATION == "comet" and 0.28 or 0.5, 0)
        streak.Size = UDim2.new(BACKGROUND_ANIMATION == "comet" and 0.42 or 0.36, 0, 1.25, 0)
        streak.Rotation = BACKGROUND_ANIMATION == "comet" and 16 or 9
        streak.BackgroundColor3 = COL_ACCENT
        streak.BackgroundTransparency = 0.35
        streak.BorderSizePixel = 0
        streak.ZIndex = 2
        streak.Parent = animationLayer
        local streakGradient = Instance.new("UIGradient")
        streakGradient.Color = ColorSequence.new(COL_CYAN, COL_ACCENT)
        streakGradient.Transparency = NumberSequence.new({
            NumberSequenceKeypoint.new(0, 1),
            NumberSequenceKeypoint.new(0.38, 0.62),
            NumberSequenceKeypoint.new(0.52, 0.08),
            NumberSequenceKeypoint.new(0.66, 0.62),
            NumberSequenceKeypoint.new(1, 1)
        })
        streakGradient.Parent = streak
        task.spawn(function()
            while animationLayer.Parent do
                streak.Position = UDim2.new(-0.55, 0, BACKGROUND_ANIMATION == "comet" and 0.28 or 0.5, 0)
                streak.BackgroundTransparency = 0.35
                local sweep = TweenService:Create(streak, TweenInfo.new(BACKGROUND_ANIMATION == "comet" and 2.1 or 3.4, Enum.EasingStyle.Linear), {
                    Position = UDim2.new(1.15, 0, BACKGROUND_ANIMATION == "comet" and 0.58 or 0.24, 0),
                    BackgroundTransparency = 0.12
                })
                sweep:Play()
                sweep.Completed:Wait()
                task.wait(BACKGROUND_ANIMATION == "comet" and 0.55 or 0.8)
            end
        end)
    elseif BACKGROUND_ANIMATION == "ripple" then
        task.spawn(function()
            local ringIndex = 0
            while animationLayer.Parent do
                ringIndex = ringIndex % 3 + 1
                local ring = Instance.new("Frame")
                ring.Name = "VoidedXRipple"
                ring.AnchorPoint = Vector2.new(0.5, 0.5)
                ring.Position = UDim2.new(ringIndex == 2 and 0.68 or 0.32, 0, ringIndex == 3 and 0.7 or 0.38, 0)
                ring.Size = UDim2.new(0, 24, 0, 24)
                ring.BackgroundTransparency = 1
                ring.BorderSizePixel = 0
                ring.ZIndex = 2
                ring.Parent = animationLayer
                local ringCorner = Instance.new("UICorner")
                ringCorner.CornerRadius = UDim.new(1, 0)
                ringCorner.Parent = ring
                local ringStroke = Instance.new("UIStroke")
                ringStroke.Color = ringIndex % 2 == 0 and COL_ACCENT or COL_CYAN
                ringStroke.Thickness = 2
                ringStroke.Transparency = 0.2
                ringStroke.Parent = ring
                local expand = TweenService:Create(ring, TweenInfo.new(2.3, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), {
                    Size = UDim2.new(0, 230, 0, 230)
                })
                local fade = TweenService:Create(ringStroke, TweenInfo.new(2.3, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), {
                    Transparency = 1,
                    Thickness = 1
                })
                expand:Play()
                fade:Play()
                task.delay(2.35, function()
                    if ring.Parent then ring:Destroy() end
                end)
                task.wait(0.78)
            end
        end)
    elseif BACKGROUND_ANIMATION == "corners" then
        for index = 1, 4 do
            local x = index % 2 == 0 and 1 or 0
            local y = index > 2 and 1 or 0
            local horizontal = Instance.new("Frame")
            horizontal.AnchorPoint = Vector2.new(x, y)
            horizontal.Position = UDim2.new(x == 1 and 1 or 0, x == 1 and -10 or 10, y == 1 and 1 or 0, y == 1 and -10 or 10)
            horizontal.Size = UDim2.new(0.22, 0, 0, 2)
            horizontal.BackgroundColor3 = index % 2 == 0 and COL_ACCENT or COL_CYAN
            horizontal.BackgroundTransparency = 0.15
            horizontal.BorderSizePixel = 0
            horizontal.ZIndex = 2
            horizontal.Parent = animationLayer
            local vertical = horizontal:Clone()
            vertical.Position = UDim2.new(x == 1 and 1 or 0, x == 1 and -10 or 10, y == 1 and 1 or 0, y == 1 and -10 or 10)
            vertical.Size = UDim2.new(0, 2, 0, 42)
            vertical.Parent = animationLayer
            TweenService:Create(horizontal, TweenInfo.new(1.6 + index * 0.18, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { BackgroundTransparency = 0.62 }):Play()
            TweenService:Create(vertical, TweenInfo.new(1.6 + index * 0.18, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { BackgroundTransparency = 0.62 }):Play()
        end
    else
        animateGlow(firstGlow, firstGlowGradient, 8, UDim2.new(0.24, 0, 0.18, 0), UDim2.new(0.72, 0, 0.56, 0))
        animateGlow(secondGlow, secondGlowGradient, 9.5, UDim2.new(0.04, 0, 0.36, 0), UDim2.new(0.68, 0, 0.54, 0))
    end
end

local uiScale = Instance.new("UIScale")
uiScale.Scale = 0.88
uiScale.Parent = card
card.Position = UDim2.new(0.5, 0, 0.5, 16)
cardStroke.Transparency = 1
TweenService:Create(uiScale, TweenInfo.new(0.48, EASE_BACK), { Scale = 1 }):Play()
TweenService:Create(card, TweenInfo.new(0.42, EASE_OUT), {
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
if BACKGROUND_ANIMATION == "scanline" or BACKGROUND_ANIMATION == "comet" then
    TweenService:Create(accentGradient, TweenInfo.new(2.8, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1), { Rotation = 180 }):Play()
elseif BACKGROUND_ANIMATION == "shimmer" then
    TweenService:Create(accentGradient, TweenInfo.new(4.5, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1), { Rotation = 360 }):Play()
end

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
submitBtn.Text = ""
submitBtn.ZIndex = 3
submitBtn.LayoutOrder = 5
submitBtn.AutoButtonColor = false
submitBtn.Parent = content
local btnCorner = Instance.new("UICorner")
btnCorner.CornerRadius = UDim.new(0, 10)
btnCorner.Parent = submitBtn
local btnGradient = Instance.new("UIGradient")
btnGradient.Rotation = 45
btnGradient.Color = ColorSequence.new(COL_CYAN, COL_ACCENT)
btnGradient.Parent = submitBtn
local submitLabel = Instance.new("TextLabel")
submitLabel.Position = UDim2.new(0, 16, 0, 0)
submitLabel.Size = UDim2.new(1, -60, 1, 0)
submitLabel.BackgroundTransparency = 1
submitLabel.Text = ${luaString(appearance.buttonLabel)}
submitLabel.TextColor3 = Color3.fromRGB(${buttonTextColor[0]}, ${buttonTextColor[1]}, ${buttonTextColor[2]})
submitLabel.Font = Enum.Font.GothamBold
submitLabel.TextSize = 13
submitLabel.TextXAlignment = Enum.TextXAlignment.Left
submitLabel.TextYAlignment = Enum.TextYAlignment.Center
submitLabel.TextTruncate = Enum.TextTruncate.AtEnd
submitLabel.ZIndex = 4
submitLabel.Parent = submitBtn
local arrowBadge = Instance.new("Frame")
arrowBadge.AnchorPoint = Vector2.new(1, 0.5)
arrowBadge.Position = UDim2.new(1, -11, 0.5, 0)
arrowBadge.Size = UDim2.new(0, 25, 0, 25)
arrowBadge.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
arrowBadge.BackgroundTransparency = 0.82
arrowBadge.BorderSizePixel = 0
arrowBadge.ZIndex = 4
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
submitArrow.ZIndex = 5
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

local introTexts = { eyebrow, badgeIcon, title, subtitle, vaultNameLabel, inputCaption, inputBox, submitLabel, submitArrow, getKeyBtn, footerLabel }
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
    local years = math.floor(days / 365)
    days = days % 365
    local parts = {}
    if years > 0 then table.insert(parts, string.format("%dy", years)) end
    if days > 0 then table.insert(parts, string.format("%dd", days)) end
    if hours > 0 then table.insert(parts, string.format("%dh", hours)) end
    if minutes > 0 then table.insert(parts, string.format("%dm", minutes)) end
    if #parts == 0 then return string.format("%ds", seconds) end
    return table.concat(parts, " ")
end

local function showKeyTimer(remainingSeconds, fileSaved, expiresAtMs)
    screenGui.Name = "VoidedXKeyStatus"

    local camera = workspace.CurrentCamera
    local viewportWidth = camera and camera.ViewportSize.X or 360
    local panelWidth = math.max(220, math.min(310, viewportWidth - 28))
    local panel = Instance.new("Frame")
    panel.AnchorPoint = Vector2.new(1, 1)
    panel.Position = UDim2.new(1, -14, 1, 20)
    panel.Size = UDim2.new(0, panelWidth, 0, 91)
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
    nameLabel.Position = UDim2.new(0, 12, 0, 7)
    nameLabel.Size = UDim2.new(1, -42, 0, 18)
    nameLabel.BackgroundTransparency = 1
    nameLabel.Text = "KEY UNLOCKED"
    nameLabel.TextColor3 = COL_GREEN
    nameLabel.Font = Enum.Font.GothamBold
    nameLabel.TextSize = 12
    nameLabel.TextXAlignment = Enum.TextXAlignment.Left
    nameLabel.TextTruncate = Enum.TextTruncate.AtEnd
    nameLabel.Parent = panel

    local timerLabel = Instance.new("TextLabel")
    timerLabel.Position = UDim2.new(0, 12, 0, 29)
    timerLabel.Size = UDim2.new(1, -24, 0, 17)
    timerLabel.BackgroundTransparency = 1
    timerLabel.TextColor3 = COL_TEXT
    timerLabel.Font = Enum.Font.Gotham
    timerLabel.TextSize = 11
    timerLabel.TextXAlignment = Enum.TextXAlignment.Left
    timerLabel.TextTruncate = Enum.TextTruncate.AtEnd
    timerLabel.Parent = panel

    local expiryLabel = Instance.new("TextLabel")
    expiryLabel.Position = UDim2.new(0, 12, 0, 49)
    expiryLabel.Size = UDim2.new(1, -24, 0, 16)
    expiryLabel.BackgroundTransparency = 1
    expiryLabel.TextColor3 = COL_TEXT
    expiryLabel.Font = Enum.Font.Gotham
    expiryLabel.TextSize = 10
    expiryLabel.TextXAlignment = Enum.TextXAlignment.Left
    expiryLabel.TextTruncate = Enum.TextTruncate.AtEnd
    expiryLabel.Parent = panel

    local fileLabel = Instance.new("TextLabel")
    fileLabel.Position = UDim2.new(0, 12, 0, 69)
    fileLabel.Size = UDim2.new(1, -24, 0, 14)
    fileLabel.BackgroundTransparency = 1
    fileLabel.TextColor3 = COL_MUTED
    fileLabel.Font = Enum.Font.Gotham
    fileLabel.TextSize = 9
    fileLabel.TextXAlignment = Enum.TextXAlignment.Left
    fileLabel.TextTruncate = Enum.TextTruncate.AtEnd
    fileLabel.Parent = panel

    timerLabel.Text = fileSaved and "Saved on this device" or "Verified · device save unavailable"
    expiryLabel.Text = type(expiresAtMs) == "number" and "Checking expiry..." or "Key is permanent"
    fileLabel.Text = fileSaved and "Local copy ready" or "This executor cannot save a local copy"

    local closeButton = Instance.new("TextButton")
    closeButton.Position = UDim2.new(1, -27, 0, 5)
    closeButton.Size = UDim2.new(0, 22, 0, 22)
    closeButton.BackgroundTransparency = 1
    closeButton.Text = "×"
    closeButton.TextColor3 = COL_TEXT
    closeButton.TextSize = 18
    closeButton.Font = Enum.Font.GothamBold
    closeButton.Parent = panel
    local dismissing = false
    local function dismissStatusNotice()
        if dismissing or not panel.Parent then return end
        dismissing = true
        TweenService:Create(panel, TweenInfo.new(0.18, EASE_OUT), {
            Position = UDim2.new(1, -14, 1, 16),
            BackgroundTransparency = 1
        }):Play()
        TweenService:Create(panelStroke, TweenInfo.new(0.16, EASE_OUT), { Transparency = 1 }):Play()
        TweenService:Create(panelScale, TweenInfo.new(0.18, EASE_OUT), { Scale = 0.94 }):Play()
        for _, textObject in ipairs({ nameLabel, timerLabel, expiryLabel, fileLabel, closeButton }) do
            if textObject:IsA("TextLabel") or textObject:IsA("TextButton") then
                TweenService:Create(textObject, TweenInfo.new(0.16, EASE_OUT), { TextTransparency = 1 }):Play()
            end
        end
        task.delay(0.2, function()
            if screenGui.Parent then screenGui:Destroy() end
        end)
    end
    closeButton.Activated:Connect(dismissStatusNotice)

    if type(remainingSeconds) ~= "number" then
        expiryLabel.Text = "Key is permanent"
        task.delay(5, dismissStatusNotice)
        return
    end

    local secondsLeft = math.max(0, math.floor(remainingSeconds))
    local lifetimeSeconds = secondsLeft
    expiryLabel.Text = "Expires in " .. formatKeyTime(secondsLeft)
    task.spawn(function()
        while panel.Parent and secondsLeft > 0 do
            expiryLabel.Text = "Expires in " .. formatKeyTime(secondsLeft)
            task.wait(1)
            secondsLeft -= 1
        end
    end)
    task.delay(lifetimeSeconds, function()
        clearSavedKey()
        if panel.Parent then
            expiryLabel.Text = "Key expired · get a new key to run again"
            expiryLabel.TextColor3 = COL_RED
            if fileSaved then fileLabel.Text = "Local copy cleared after expiry" end
        end
    end)
    task.delay(5, dismissStatusNotice)
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
    animateDots(submitLabel, "Verifying")

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
    submitLabel.Text = ${luaString(appearance.buttonLabel)}

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
    submitLabel.Text = "Success"
    submitLabel.TextColor3 = Color3.fromRGB(15, 23, 42)
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
    vxRunPayload(result.token, player.UserId)
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
`));
}

function sanitizeGuiAppearance(raw = {}) {
    if (!raw || typeof raw !== 'object') raw = {};
    const text = (value, fallback, maxLength) => typeof value === 'string'
        ? value.replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').trim().slice(0, maxLength) || fallback
        : fallback;
    const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
        ? value
        : fallback;
    const backgroundAnimation = ['none', 'aurora', 'drift', 'orbit', 'nebula', 'waves', 'pulse', 'scanline', 'starlight', 'shimmer', 'particles', 'ripple', 'comet', 'grid', 'corners'].includes(raw.backgroundAnimation)
        ? raw.backgroundAnimation
        : 'aurora';
    const backgroundColor = color(raw.backgroundColor, '#0b0d12');
    const requestedTextColor = color(raw.textColor, '#f8fafc');
    const linearChannel = channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = hex => {
        const values = hex.slice(1).match(/.{2}/g).map(part => parseInt(part, 16));
        return 0.2126 * linearChannel(values[0]) + 0.7152 * linearChannel(values[1]) + 0.0722 * linearChannel(values[2]);
    };
    const contrast = (first, second) => {
        const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const textColor = contrast(requestedTextColor, backgroundColor) >= 4.5
        ? requestedTextColor
        : (contrast('#f8fafc', backgroundColor) >= contrast('#111827', backgroundColor) ? '#f8fafc' : '#111827');
    return {
        title: text(raw.title, 'VoidedX Key System', 40),
        subtitle: text(raw.subtitle, 'Enter your key to continue', 64),
        buttonLabel: text(raw.buttonLabel, 'Submit', 20),
        accentColor: color(raw.accentColor, '#06b6d4'),
        secondaryColor: color(raw.secondaryColor, '#6366f1'),
        backgroundColor,
        textColor,
        backgroundAnimation
    };
}
