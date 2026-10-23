var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),s=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},c=(n,r,a)=>(a=n==null?{}:e(i(n)),s(r||!n||!n.__esModule?t(a,`default`,{value:n,enumerable:!0}):a,n)),l=``+new URL(`glue-Dlydm7r2.wasm`,import.meta.url).href,u={cli:`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- cli.lua
--
-- This Script contains the Code for the Prometheus CLI.

-- Configure package.path for requiring Prometheus.
local function script_path()
	local str = debug.getinfo(2, "S").source:sub(2)
	return str:match("(.*[/%\\\\])")
end
package.path = script_path() .. "?.lua;" .. package.path

local INSTALL_SCRIPT_URL = "https://raw.githubusercontent.com/prometheus-lua/Prometheus/master/install.sh"

local function run_shell(command)
	local ok = os.execute(command)
	if type(ok) == "number" then
		return ok == 0
	end
	if type(ok) == "boolean" then
		return ok
	end
	return false
end

local function get_version()
	local version = os.getenv("PROMETHEUS_LUA_VERSION")
	if version and version ~= "" then
		return version
	end
	return "dev"
end

local function print_help()
	print("Prometheus Lua CLI")
	print("Usage: prometheus-lua [command] [options] <input.lua>")
	print("")
	print("Commands:")
	print("  update                 Install latest release via installer script")
	print("  --version, -v          Print CLI version")
	print("")
	print("Obfuscation options:")
	print("  --preset, --p <name>   Use preset (e.g. Minify, Medium, High)")
	print("  --config, --c <file>   Use custom config Lua file")
	print("  --out, --o <file>      Set output path")
	print("  --Lua51                Force Lua 5.1 target")
	print("  --LuaU                 Force LuaU target")
	print("  --pretty               Pretty print output")
	print("  --nocolors             Disable colored logs")
	print("  --saveerrors           Persist parser errors to file")
end

local function run_update()
	local command
	if run_shell("command -v curl >/dev/null 2>&1") then
		command = string.format("curl -fsSL '%s' | sh", INSTALL_SCRIPT_URL)
	elseif run_shell("command -v wget >/dev/null 2>&1") then
		command = string.format("wget -qO- '%s' | sh", INSTALL_SCRIPT_URL)
	else
		io.stderr:write("Neither curl nor wget was found. Please install one of them and retry.\\n")
		os.exit(1)
	end

	print("Updating prometheus-lua using official installer")
	if not run_shell(command) then
		io.stderr:write("Update failed\\n")
		os.exit(1)
	end

	print("Update completed")
end

if arg[1] == "update" then
	run_update()
	os.exit(0)
end

if arg[1] == "--version" or arg[1] == "-v" then
	print(get_version())
	os.exit(0)
end

if arg[1] == "--help" or arg[1] == "-h" or arg[1] == "help" then
	print_help()
	os.exit(0)
end

---@diagnostic disable-next-line: different-requires
local Prometheus = require("prometheus")
Prometheus.Logger.logLevel = Prometheus.Logger.LogLevel.Info
Prometheus.Logger.errorCallback = function(...)
	local args = { ... }
	local message = table.concat(args, " ")
	io.stderr:write(Prometheus.colors(Prometheus.Config.NameUpper .. ": " .. message, "red") .. "\\n")
	os.exit(1)
end

-- Check if the file exists
local function file_exists(file)
	local f = io.open(file, "rb")
	if f then
		f:close()
	end
	return f ~= nil
end

string.split = function(str, sep)
	local fields = {}
	local pattern = string.format("([^%s]+)", sep)
	str:gsub(pattern, function(c)
		fields[#fields + 1] = c
	end)
	return fields
end

-- get all lines from a file, returns an empty
-- list/table if the file does not exist
local function lines_from(file)
	if not file_exists(file) then
		return {}
	end
	local lines = {}
	for line in io.lines(file) do
		lines[#lines + 1] = line
	end
	return lines
end

local function load_chunk(content, chunkName, environment)
	if type(loadstring) == "function" then
		local func, err = loadstring(content, chunkName)
		if not func then
			return nil, err
		end
		if environment and type(setfenv) == "function" then
			setfenv(func, environment)
		elseif environment and type(load) == "function" then
			return load(content, chunkName, "t", environment)
		end
		return func
	end

	if type(load) ~= "function" then
		return nil, "No load function available"
	end

	return load(content, chunkName, "t", environment)
end

local function run_cli()
	-- CLI
	local config, sourceFile, outFile, luaVersion, prettyPrint

	Prometheus.colors.enabled = true

	-- Parse Arguments
	local i = 1
	while i <= #arg do
		local curr = arg[i]
		if curr:sub(1, 2) == "--" then
			if curr == "--preset" or curr == "--p" then
				if config then
					Prometheus.Logger:warn("The config was set multiple times")
				end

				i = i + 1
				local preset = Prometheus.Presets[arg[i]]
				if not preset then
					Prometheus.Logger:error(string.format('A Preset with the name "%s" was not found!', tostring(arg[i])))
				end

				config = preset
			elseif curr == "--config" or curr == "--c" then
				i = i + 1
				local filename = tostring(arg[i])
				if not file_exists(filename) then
					Prometheus.Logger:error(string.format('The config file "%s" was not found!', filename))
				end

				local content = table.concat(lines_from(filename), "\\n")
				-- Load Config from File
				local func, err = load_chunk(content, "@" .. filename, {})
				if not func then
					Prometheus.Logger:error(string.format('Failed to parse config file "%s": %s', filename, tostring(err)))
				end
				config = func()
			elseif curr == "--out" or curr == "--o" then
				i = i + 1
				if outFile then
					Prometheus.Logger:warn("The output file was specified multiple times!")
				end
				outFile = arg[i]
			elseif curr == "--nocolors" then
				Prometheus.colors.enabled = false
			elseif curr == "--Lua51" then
				luaVersion = "Lua51"
			elseif curr == "--LuaU" then
				luaVersion = "LuaU"
			elseif curr == "--pretty" then
				prettyPrint = true
			elseif curr == "--saveerrors" then
				-- Override error callback
				Prometheus.Logger.errorCallback = function(...)
					local args = { ... }
					local message = table.concat(args, " ")
					io.stderr:write(Prometheus.colors(Prometheus.Config.NameUpper .. ": " .. message, "red") .. "\\n")

					local fileName = sourceFile:sub(-4) == ".lua" and sourceFile:sub(0, -5) .. ".error.txt"
						or sourceFile .. ".error.txt"
					local handle = io.open(fileName, "w")
					handle:write(message)
					handle:close()

					os.exit(1)
				end
			else
				Prometheus.Logger:warn(string.format('The option "%s" is not valid and therefore ignored', curr))
			end
		else
			if sourceFile then
				Prometheus.Logger:error(string.format('Unexpected argument "%s"', arg[i]))
			end
			sourceFile = tostring(arg[i])
		end
		i = i + 1
	end

	if not sourceFile then
		Prometheus.Logger:error("No input file was specified!")
	end

	if not config then
		Prometheus.Logger:warn("No config was specified, falling back to Minify preset")
		config = Prometheus.Presets.Minify
	end

	-- Add Option to override Lua Version
	config.LuaVersion = luaVersion or config.LuaVersion
	config.PrettyPrint = prettyPrint ~= nil and prettyPrint or config.PrettyPrint

	if not file_exists(sourceFile) then
		Prometheus.Logger:error(string.format('The File "%s" was not found!', sourceFile))
	end

	if not outFile then
		if sourceFile:sub(-4) == ".lua" then
			outFile = sourceFile:sub(0, -5) .. ".obfuscated.lua"
		else
			outFile = sourceFile .. ".obfuscated.lua"
		end
	end

	local source = table.concat(lines_from(sourceFile), "\\n")
	local pipeline = Prometheus.Pipeline:fromConfig(config)
	local out = pipeline:apply(source, sourceFile)
	Prometheus.Logger:info(string.format('Writing output to "%s"', outFile))

	-- Write Output
	local handle = io.open(outFile, "w")
	handle:write(out)
	handle:close()
end

local ok, err = xpcall(run_cli, function(e)
	return tostring(e)
end)
if not ok then
	local message = tostring(err):gsub("^.-:%d+:%s*", "")
	io.stderr:write(Prometheus.colors(Prometheus.Config.NameUpper .. ": " .. message, "red") .. "\\n")
	os.exit(1)
end
`,colors:`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- colors.lua
--
-- This Script provides a simple method for syntax highlighting of Lua code

local keys = {
	reset = 0,
	bright = 1,
	dim = 2,
	underline = 4,
	blink = 5,
	reverse = 7,
	hidden = 8,
	black = 30,
	pink = 91,
	red = 31,
	green = 32,
	yellow = 33,
	blue = 34,
	magenta = 35,
	cyan = 36,
	grey = 37,
	gray = 37,
	white = 97,
	blackbg = 40,
	redbg = 41,
	greenbg = 42,
	yellowbg = 43,
	bluebg = 44,
	magentabg = 45,
	cyanbg = 46,
	greybg = 47,
	graybg = 47,
	whitebg = 107,
}

local escapeString = string.char(27) .. "[%dm"
local function escapeNumber(number)
	return escapeString:format(number)
end

local settings = {
	enabled = true,
}

local function colors(str, ...)
	if not settings.enabled then
		return str
	end
	str = tostring(str or "")

	local escapes = {}
	for _, name in ipairs({ ... }) do
		table.insert(escapes, escapeNumber(keys[name]))
	end

	return escapeNumber(keys.reset) .. table.concat(escapes) .. str .. escapeNumber(keys.reset)
end

return setmetatable(settings, {
	__call = function(_, ...)
		return colors(...)
	end,
})
`,config:`-- This Script is Part of the Prometheus Obfuscator by Levno_710
--
-- config.lua
--
-- In this Script, some Global config Variables are defined

local NAME = "Prometheus";
local REVISION = "Alpha";
local VERSION = "v0.2";
local BY = "levno-710";

for _, currArg in pairs(arg) do
	if currArg == "--CI" then
		local releaseName = string.gsub(string.format("%s %s %s", NAME, REVISION, VERSION), "%s", "-")
		print(releaseName)
	end

	if currArg == "--FullVersion" then
		print(VERSION)
	end
end

-- Config Starts here
return {
	Name = NAME,
	NameUpper = string.upper(NAME),
	NameAndVersion = string.format("%s %s", NAME, VERSION),
	Version = VERSION;
	Revision = REVISION;
	-- Config Starts Here
	IdentPrefix = "__prometheus_"; -- The Prefix used for Identifiers generated by PROMETHEUS. NOTE: There should be no identifiers in the script to be obfuscated starting with that prefix, because that can lead to weird bugs

	SPACE = " "; -- The Whitespace to be used by the unparser
	TAB = "\\t"; -- The Tab Whitespace to be used by the unparser for pretty printing
}`,highlightlua:`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- highlightlua.lua
--
-- This Script provides a simple Method for Syntax Highlighting of Lua code

local Tokenizer = require("prometheus.tokenizer");
local colors = require("colors");
local TokenKind = Tokenizer.TokenKind;
local lookupify = require("prometheus.util").lookupify;

return function(code, luaVersion)
    local out = "";
    local tokenizer = Tokenizer:new({
        LuaVersion = luaVersion,
    });

    tokenizer:append(code);
    local tokens = tokenizer:scanAll();

    local nonColorSymbols = lookupify{
        ",", ";", "(", ")", "{", "}", ".", ":", "[", "]"
    }

    local defaultGlobals = lookupify{
        "string", "table", "bit32", "bit"
    }

    local currentPos = 1;
    for _, token in ipairs(tokens) do
        if token.startPos >= currentPos then
            out = out .. string.sub(code, currentPos, token.startPos);
        end
        if token.kind == TokenKind.Ident then
            if defaultGlobals[token.source] then
                out = out .. colors(token.source, "red");
            else
                out = out .. token.source;
            end
        elseif token.kind == TokenKind.Keyword then
            if token.source == "nil" then
                out = out .. colors(token.source, "yellow");
            else
                out = out .. colors(token.source, "yellow");
            end
        elseif token.kind == TokenKind.Symbol then
            if nonColorSymbols[token.source] then
                out = out .. token.source;
            else
                out = out .. colors(token.source, "yellow");
            end
        elseif token.kind == TokenKind.String then
            out = out .. colors(token.source, "green")
        elseif token.kind == TokenKind.Number then
            out = out .. colors(token.source, "red")
        else
            out = out .. token.source;
        end

        currentPos = token.endPos + 1;
    end
    return out;
end`,logger:`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- logger.lua
--
-- This Script provides a Logger for Prometheus.

local logger = {}
local config = require("config");
local colors = require("colors");

logger.LogLevel = {
	Error = 0,
	Warn = 1,
	Log = 2,
	Info = 2,
	Debug = 3,
}

logger.logLevel = logger.LogLevel.Log;

logger.debugCallback = function(...)
	print(colors(config.NameUpper .. ": " ..  ..., "grey"));
end;
function logger:debug(...)
	if self.logLevel >= self.LogLevel.Debug then
		self.debugCallback(...);
	end
end

logger.logCallback = function(...)
	print(colors(config.NameUpper .. ": ", "magenta") .. ...);
end;
function logger:log(...)
	if self.logLevel >= self.LogLevel.Log then
		self.logCallback(...);
	end
end

function logger:info(...)
	if self.logLevel >= self.LogLevel.Log then
		self.logCallback(...);
	end
end

logger.warnCallback = function(...)
	print(colors(config.NameUpper .. ": " .. ..., "yellow"));
end;
function logger:warn(...)
	if self.logLevel >= self.LogLevel.Warn then
		self.warnCallback(...);
	end
end

logger.errorCallback = function(...)
	print(colors(config.NameUpper .. ": " .. ..., "red"))
	error(...);
end;
function logger:error(...)
	self.errorCallback(...);
	error(config.NameUpper .. ": logger.errorCallback did not throw an Error!");
end


return logger;`,presets:`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- presets.lua
--
-- This Script provides the predefined obfuscation presets for Prometheus

return {
	-- Minifies your code. Does not obfuscate it. No performance loss.
	["Minify"] = {
		LuaVersion = "Lua51",
		VarNamePrefix = "",
		NameGenerator = "MangledShuffled",
		PrettyPrint = false,
		Seed = 0,
		Steps = {},
	},

	-- Weak obfuscation. Very readable, low performance loss.
	["Weak"] = {
		LuaVersion = "Lua51",
		VarNamePrefix = "",
		NameGenerator = "MangledShuffled",
		PrettyPrint = false,
		Seed = 0,
		Steps = {
			{ Name = "Vmify", Settings = {} },
			{
				Name = "ConstantArray",
				Settings = {
					Threshold = 1,
					StringsOnly = true
				},
			},
			{ Name = "WrapInFunction", Settings = {} },
		},
	},

	-- This is here for the tests.lua file.
	-- It helps isolate any problems with the Vmify step.
	-- It is not recommended to use this preset for obfuscation.
	-- Use the Weak, Medium, or Strong for obfuscation instead.
	["Vmify"] = {
		LuaVersion = "Lua51",
		VarNamePrefix = "",
		NameGenerator = "MangledShuffled",
		PrettyPrint = false,
		Seed = 0,
		Steps = {
			{ Name = "Vmify", Settings = {} },
		},
	},

	-- Medium obfuscation. Moderate obfuscation, moderate performance loss.
	["Medium"] = {
		LuaVersion = "Lua51",
		VarNamePrefix = "",
		NameGenerator = "MangledShuffled",
		PrettyPrint = false,
		Seed = 0,
		Steps = {
			{ Name = "EncryptStrings", Settings = {} },
			{
				Name = "AntiTamper",
				Settings = {
					UseDebug = false,
				},
			},
			{ Name = "Vmify", Settings = {} },
			{
				Name = "ConstantArray",
				Settings = {
					Threshold = 1,
					StringsOnly = true,
					Shuffle = true,
					Rotate = true,
					LocalWrapperThreshold = 0,
				},
			},
			{ Name = "NumbersToExpressions", Settings = {} },
			{ Name = "WrapInFunction", Settings = {} },
		},
	},

	-- Strong obfuscation, high performance loss.
	["Strong"] = {
		LuaVersion = "Lua51",
		VarNamePrefix = "",
		NameGenerator = "MangledShuffled",
		PrettyPrint = false,
		Seed = 0,
		Steps = {
			{ Name = "Vmify", Settings = {} },
			{ Name = "EncryptStrings", Settings = {} },
			{
				Name = "AntiTamper",
				Settings = {
					UseDebug = false,
				},
			},
			{ Name = "Vmify", Settings = {} },
			{
				Name = "ConstantArray",
				Settings = {
					Threshold = 1,
					StringsOnly = true,
					Shuffle = true,
					Rotate = true,
					LocalWrapperThreshold = 0
				},
			},
			{
				Name = "NumbersToExpressions",
				Settings = {
					NumberRepresentationMutation = true
				},
			},
			{ Name = "WrapInFunction", Settings = {} },
		},
	},
}
`,"prometheus.ast":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- ast.lua
--
-- This Script provides the Abstract Syntax Tree (AST) for Prometheus.

local Ast = {}

local AstKind = {
	-- Misc
	TopNode = "TopNode";
	Block = "Block";

	-- Statements
	ContinueStatement = "ContinueStatement";
	BreakStatement = "BreakStatement";
	DoStatement = "DoStatement";
	WhileStatement = "WhileStatement";
	ReturnStatement = "ReturnStatement";
	RepeatStatement = "RepeatStatement";
	ForInStatement = "ForInStatement";
	ForStatement = "ForStatement";
	IfStatement = "IfStatement";
	FunctionDeclaration = "FunctionDeclaration";
	LocalFunctionDeclaration = "LocalFunctionDeclaration";
	LocalVariableDeclaration = "LocalVariableDeclaration";
	FunctionCallStatement = "FunctionCallStatement";
	PassSelfFunctionCallStatement = "PassSelfFunctionCallStatement";
	AssignmentStatement = "AssignmentStatement";

	-- LuaU Compound Statements
	CompoundAddStatement = "CompoundAddStatement";
	CompoundSubStatement = "CompoundSubStatement";
	CompoundMulStatement = "CompoundMulStatement";
	CompoundDivStatement = "CompoundDivStatement";
	CompoundModStatement = "CompoundModStatement";
	CompoundPowStatement = "CompoundPowStatement";
	CompoundConcatStatement = "CompoundConcatStatement";

	-- Assignment Index
	AssignmentIndexing = "AssignmentIndexing";
	AssignmentVariable = "AssignmentVariable";

	-- Expression Nodes
	BooleanExpression = "BooleanExpression";
	NumberExpression = "NumberExpression";
	StringExpression = "StringExpression";
	NilExpression = "NilExpression";
	VarargExpression = "VarargExpression";
	OrExpression = "OrExpression";
	AndExpression = "AndExpression";
	LessThanExpression = "LessThanExpression";
	GreaterThanExpression = "GreaterThanExpression";
	LessThanOrEqualsExpression = "LessThanOrEqualsExpression";
	GreaterThanOrEqualsExpression = "GreaterThanOrEqualsExpression";
	NotEqualsExpression = "NotEqualsExpression";
	EqualsExpression = "EqualsExpression";
	StrCatExpression = "StrCatExpression";
	AddExpression = "AddExpression";
	SubExpression = "SubExpression";
	MulExpression = "MulExpression";
	DivExpression = "DivExpression";
	ModExpression = "ModExpression";
	NotExpression = "NotExpression";
	LenExpression = "LenExpression";
	NegateExpression = "NegateExpression";
	PowExpression = "PowExpression";
	IndexExpression = "IndexExpression";
	FunctionCallExpression = "FunctionCallExpression";
	PassSelfFunctionCallExpression = "PassSelfFunctionCallExpression";
	VariableExpression = "VariableExpression";
	FunctionLiteralExpression = "FunctionLiteralExpression";
	TableConstructorExpression = "TableConstructorExpression";

	-- Table Entry
	TableEntry = "TableEntry";
	KeyedTableEntry = "KeyedTableEntry";

	-- Misc
	NopStatement = "NopStatement";

	IfElseExpression = "IfElseExpression";
}

local astKindExpressionLookup = {
	[AstKind.BooleanExpression] = 0;
	[AstKind.NumberExpression] = 0;
	[AstKind.StringExpression] = 0;
	[AstKind.NilExpression] = 0;
	[AstKind.VarargExpression] = 0;
	[AstKind.OrExpression] = 12;
	[AstKind.AndExpression] = 11;
	[AstKind.LessThanExpression] = 10;
	[AstKind.GreaterThanExpression] = 10;
	[AstKind.LessThanOrEqualsExpression] = 10;
	[AstKind.GreaterThanOrEqualsExpression] = 10;
	[AstKind.NotEqualsExpression] = 10;
	[AstKind.EqualsExpression] = 10;
	[AstKind.StrCatExpression] = 9;
	[AstKind.AddExpression] = 8;
	[AstKind.SubExpression] = 8;
	[AstKind.MulExpression] = 7;
	[AstKind.DivExpression] = 7;
	[AstKind.ModExpression] = 7;
	[AstKind.NotExpression] = 5;
	[AstKind.LenExpression] = 5;
	[AstKind.NegateExpression] = 5;
	[AstKind.PowExpression] = 4;
	[AstKind.IndexExpression] = 1;
	[AstKind.AssignmentIndexing] = 1;
	[AstKind.FunctionCallExpression] = 2;
	[AstKind.PassSelfFunctionCallExpression] = 2;
	[AstKind.VariableExpression] = 0;
	[AstKind.AssignmentVariable] = 0;
	[AstKind.FunctionLiteralExpression] = 3;
	[AstKind.TableConstructorExpression] = 3;
}

Ast.AstKind = AstKind;

function Ast.astKindExpressionToNumber(kind)
	return astKindExpressionLookup[kind] or 100;
end

function Ast.ConstantNode(val)
	if type(val) == "nil" then
		return Ast.NilExpression();
	end

	if type(val) == "string" then
		return Ast.StringExpression(val);
	end

	if type(val) == "number" then
		return Ast.NumberExpression(val);
	end

	if type(val) == "boolean" then
		return Ast.BooleanExpression(val);
	end
end



function Ast.NopStatement()
	return {
		kind = AstKind.NopStatement;
	}
end

function Ast.IfElseExpression(condition, true_value, elseifs, false_value)
	return {
		kind = AstKind.IfElseExpression,
		condition = condition,
		true_value = true_value,
		elseifs = elseifs,
		false_value = false_value
	}
end

-- Create Ast Top Node
function Ast.TopNode(body, globalScope)
	return {
		kind = AstKind.TopNode,
		body = body,
		globalScope = globalScope,

	}
end

function Ast.TableEntry(value)
	return {
		kind = AstKind.TableEntry,
		value = value,

	}
end

function Ast.KeyedTableEntry(key, value)
	return {
		kind = AstKind.KeyedTableEntry,
		key = key,
		value = value,

	}
end

function Ast.TableConstructorExpression(entries)
	return {
		kind = AstKind.TableConstructorExpression,
		entries = entries,
	};
end

-- Create Statement Block
function Ast.Block(statements, scope)
	return {
		kind = AstKind.Block,
		statements = statements,
		scope = scope,
	}
end

-- Create Break Statement
function Ast.BreakStatement(loop, scope)
	return {
		kind = AstKind.BreakStatement,
		loop = loop,
		scope = scope,
	}
end

-- Create Continue Statement
function Ast.ContinueStatement(loop, scope)
	return {
		kind = AstKind.ContinueStatement,
		loop = loop,
		scope = scope,
	}
end

function Ast.PassSelfFunctionCallStatement(base, passSelfFunctionName, args)
	return {
		kind = AstKind.PassSelfFunctionCallStatement,
		base = base,
		passSelfFunctionName = passSelfFunctionName,
		args = args,
	}
end

function Ast.AssignmentStatement(lhs, rhs)
	if(#lhs < 1) then
		print(debug.traceback());
		error("Something went wrong!");
	end
	return {
		kind = AstKind.AssignmentStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.CompoundAddStatement(lhs, rhs)
	return {
		kind = AstKind.CompoundAddStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.CompoundSubStatement(lhs, rhs)
	return {
		kind = AstKind.CompoundSubStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.CompoundMulStatement(lhs, rhs)
	return {
		kind = AstKind.CompoundMulStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.CompoundDivStatement(lhs, rhs)
	return {
		kind = AstKind.CompoundDivStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.CompoundPowStatement(lhs, rhs)
	return {
		kind = AstKind.CompoundPowStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.CompoundModStatement(lhs, rhs)
	return {
		kind = AstKind.CompoundModStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.CompoundConcatStatement(lhs, rhs)
	return {
		kind = AstKind.CompoundConcatStatement,
		lhs = lhs,
		rhs = rhs,
	}
end

function Ast.FunctionCallStatement(base, args)
	return {
		kind = AstKind.FunctionCallStatement,
		base = base,
		args = args,
	}
end

function Ast.ReturnStatement(args)
	return {
		kind = AstKind.ReturnStatement,
		args = args,
	}
end

function Ast.DoStatement(body)
	return {
		kind = AstKind.DoStatement,
		body = body,
	}
end

function Ast.WhileStatement(body, condition, parentScope)
	return {
		kind = AstKind.WhileStatement,
		body = body,
		condition = condition,
		parentScope = parentScope,
	}
end

function Ast.ForInStatement(scope, vars, expressions, body, parentScope)
	return {
		kind = AstKind.ForInStatement,
		scope = scope,
		ids = vars,
		vars = vars,
		expressions = expressions,
		body = body,
		parentScope = parentScope,
	}
end

function Ast.ForStatement(scope, id, initialValue, finalValue, incrementBy, body, parentScope)
	return {
		kind = AstKind.ForStatement,
		scope = scope,
		id = id,
		initialValue = initialValue,
		finalValue = finalValue,
		incrementBy = incrementBy,
		body = body,
		parentScope = parentScope,
	}
end

function Ast.RepeatStatement(condition, body, parentScope)
	return {
		kind = AstKind.RepeatStatement,
		body = body,
		condition = condition,
		parentScope = parentScope,
	}
end

function Ast.IfStatement(condition, body, elseifs, elsebody)
	return {
		kind = AstKind.IfStatement,
		condition = condition,
		body = body,
		elseifs = elseifs,
		elsebody = elsebody,
	}
end

function Ast.FunctionDeclaration(scope, id, indices, args, body)
	return {
		kind = AstKind.FunctionDeclaration,
		scope = scope,
		baseScope = scope,
		id = id,
		baseId = id,
		indices = indices,
		args = args,
		body = body,
		getName = function(self)
			return self.scope:getVariableName(self.id);
		end,
	}
end

function Ast.LocalFunctionDeclaration(scope, id, args, body)
	return {
		kind = AstKind.LocalFunctionDeclaration,
		scope = scope,
		id = id,
		args = args,
		body = body,
		getName = function(self)
			return self.scope:getVariableName(self.id);
		end,
	}
end

function Ast.LocalVariableDeclaration(scope, ids, expressions)
	return {
		kind = AstKind.LocalVariableDeclaration,
		scope = scope,
		ids = ids,
		expressions = expressions,
	}
end

function Ast.VarargExpression()
	return {
		kind = AstKind.VarargExpression;
		isConstant = false,
	}
end

function Ast.BooleanExpression(value)
	return {
		kind = AstKind.BooleanExpression,
		isConstant = true,
		value = value,
	}
end

function Ast.NilExpression()
	return {
		kind = AstKind.NilExpression,
		isConstant = true,
		value = nil,
	}
end

function Ast.NumberExpression(value)
	return {
		kind = AstKind.NumberExpression,
		isConstant = true,
		value = value,
	}
end

function Ast.StringExpression(value)
	return {
		kind = AstKind.StringExpression,
		isConstant = true,
		value = value,
	}
end

function Ast.OrExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value or rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.OrExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.AndExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value and rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.AndExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.LessThanExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value < rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.LessThanExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.GreaterThanExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value > rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.GreaterThanExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.LessThanOrEqualsExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value <= rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.LessThanOrEqualsExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.GreaterThanOrEqualsExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value >= rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.GreaterThanOrEqualsExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.NotEqualsExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value ~= rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.NotEqualsExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.EqualsExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value == rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.EqualsExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.StrCatExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value .. rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.StrCatExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.AddExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value + rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.AddExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.SubExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value - rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.SubExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.MulExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value * rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.MulExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.DivExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant and rhs.value ~= 0) then
		local success, val = pcall(function() return lhs.value / rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.DivExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.ModExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value % rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.ModExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.NotExpression(rhs, simplify)
	if(simplify and rhs.isConstant) then
		local success, val = pcall(function() return not rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.NotExpression,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.NegateExpression(rhs, simplify)
	if(simplify and rhs.isConstant) then
		local success, val = pcall(function() return -rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.NegateExpression,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.LenExpression(rhs, simplify)
	if(simplify and rhs.isConstant) then
		local success, val = pcall(function() return #rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.LenExpression,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.PowExpression(lhs, rhs, simplify)
	if(simplify and rhs.isConstant and lhs.isConstant) then
		local success, val = pcall(function() return lhs.value ^ rhs.value end);
		if success then
			return Ast.ConstantNode(val);
		end
	end

	return {
		kind = AstKind.PowExpression,
		lhs = lhs,
		rhs = rhs,
		isConstant = false,
	}
end

function Ast.IndexExpression(base, index)
	return {
		kind = AstKind.IndexExpression,
		base = base,
		index = index,
		isConstant = false,
	}
end

function Ast.AssignmentIndexing(base, index)
	return {
		kind = AstKind.AssignmentIndexing,
		base = base,
		index = index,
		isConstant = false,
	}
end

function Ast.PassSelfFunctionCallExpression(base, passSelfFunctionName, args)
	return {
		kind = AstKind.PassSelfFunctionCallExpression,
		base = base,
		passSelfFunctionName = passSelfFunctionName,
		args = args,

	}
end

function Ast.FunctionCallExpression(base, args)
	return {
		kind = AstKind.FunctionCallExpression,
		base = base,
		args = args,
	}
end

function Ast.VariableExpression(scope, id)
	scope:addReference(id);
	return {
		kind = AstKind.VariableExpression,
		scope = scope,
		id = id,
		getName = function(self)
			return self.scope.getVariableName(self.id);
		end,
	}
end

function Ast.AssignmentVariable(scope, id)
	scope:addReference(id);
	return {
		kind = AstKind.AssignmentVariable,
		scope = scope,
		id = id,
		getName = function(self)
			return self.scope.getVariableName(self.id);
		end,
	}
end

function Ast.FunctionLiteralExpression(args, body)
	return {
		kind = AstKind.FunctionLiteralExpression,
		args = args,
		body = body,
	}
end



return Ast;
`,"prometheus.compiler.block":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- block.lua
--
-- Block management for the compiler

local Scope = require("prometheus.scope");
local util = require("prometheus.util");

local lookupify = util.lookupify;

return function(Compiler)
    function Compiler:createBlock()
        local id;
        repeat
            id = math.random(0, 2^24)
        until not self.usedBlockIds[id];
        self.usedBlockIds[id] = true;

        local scope = Scope:new(self.containerFuncScope);
        local block = {
            id = id;
            statements = {};
            scope = scope;
            advanceToNextBlock = true;
        };
        table.insert(self.blocks, block);
        return block;
    end

    function Compiler:setActiveBlock(block)
        self.activeBlock = block;
    end

    function Compiler:addStatement(statement, writes, reads, usesUpvals)
        if(self.activeBlock.advanceToNextBlock) then
            table.insert(self.activeBlock.statements, {
                statement = statement,
                writes = lookupify(writes),
                reads = lookupify(reads),
                usesUpvals = usesUpvals or false,
            });
        end
    end
end

`,"prometheus.compiler.compiler":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- compiler.lua
--
-- This Script is the main compiler module.

local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");
local util = require("prometheus.util");

local lookupify = util.lookupify;
local AstKind = Ast.AstKind;

local unpack = unpack or table.unpack;

local blockModule = require("prometheus.compiler.block");
local registerModule = require("prometheus.compiler.register");
local upvalueModule = require("prometheus.compiler.upvalue");
local emitModule = require("prometheus.compiler.emit");
local compileCoreModule = require("prometheus.compiler.compile_core");

local Compiler = {};

function Compiler:new()
    local compiler = {
        blocks = {};
        registers = {};
        activeBlock = nil;
        registersForVar = {};
        usedRegisters = 0;
        maxUsedRegister = 0;
        registerVars = {};

        VAR_REGISTER = newproxy(false);
        RETURN_ALL = newproxy(false);
        POS_REGISTER = newproxy(false);
        RETURN_REGISTER = newproxy(false);
        UPVALUE = newproxy(false);

        BIN_OPS = lookupify{
            AstKind.LessThanExpression,
            AstKind.GreaterThanExpression,
            AstKind.LessThanOrEqualsExpression,
            AstKind.GreaterThanOrEqualsExpression,
            AstKind.NotEqualsExpression,
            AstKind.EqualsExpression,
            AstKind.StrCatExpression,
            AstKind.AddExpression,
            AstKind.SubExpression,
            AstKind.MulExpression,
            AstKind.DivExpression,
            AstKind.ModExpression,
            AstKind.PowExpression,
        };
    };

    setmetatable(compiler, self);
    self.__index = self;

    return compiler;
end

blockModule(Compiler);
registerModule(Compiler);
upvalueModule(Compiler);
emitModule(Compiler);
compileCoreModule(Compiler);

function Compiler:pushRegisterUsageInfo()
    table.insert(self.registerUsageStack, {
        usedRegisters = self.usedRegisters;
        registers = self.registers;
    });
    self.usedRegisters = 0;
    self.registers = {};
end

function Compiler:popRegisterUsageInfo()
    local info = table.remove(self.registerUsageStack);
    self.usedRegisters = info.usedRegisters;
    self.registers = info.registers;
end

function Compiler:compile(ast)
    self.blocks = {};
    self.registers = {};
    self.activeBlock = nil;
    self.registersForVar = {};
    self.scopeFunctionDepths = {};
    self.maxUsedRegister = 0;
    self.usedRegisters = 0;
    self.registerVars = {};
    self.usedBlockIds = {};

    self.upvalVars = {};
    self.registerUsageStack = {};

    self.upvalsProxyLenReturn = math.random(-2^22, 2^22);

    local newGlobalScope = Scope:newGlobal();
    local psc = Scope:new(newGlobalScope, nil);

    local _, getfenvVar = newGlobalScope:resolve("getfenv");
    local _, tableVar = newGlobalScope:resolve("table");
    local _, unpackVar = newGlobalScope:resolve("unpack");
    local _, envVar = newGlobalScope:resolve("_ENV");
    local _, newproxyVar = newGlobalScope:resolve("newproxy");
    local _, setmetatableVar = newGlobalScope:resolve("setmetatable");
    local _, getmetatableVar = newGlobalScope:resolve("getmetatable");
    local _, selectVar = newGlobalScope:resolve("select");

    psc:addReferenceToHigherScope(newGlobalScope, getfenvVar, 2);
    psc:addReferenceToHigherScope(newGlobalScope, tableVar);
    psc:addReferenceToHigherScope(newGlobalScope, unpackVar);
    psc:addReferenceToHigherScope(newGlobalScope, envVar);
    psc:addReferenceToHigherScope(newGlobalScope, newproxyVar);
    psc:addReferenceToHigherScope(newGlobalScope, setmetatableVar);
    psc:addReferenceToHigherScope(newGlobalScope, getmetatableVar);

    self.scope = Scope:new(psc);
    self.envVar = self.scope:addVariable();
    self.containerFuncVar = self.scope:addVariable();
    self.unpackVar = self.scope:addVariable();
    self.newproxyVar = self.scope:addVariable();
    self.setmetatableVar = self.scope:addVariable();
    self.getmetatableVar = self.scope:addVariable();
    self.selectVar = self.scope:addVariable();

    local argVar = self.scope:addVariable();

    self.containerFuncScope = Scope:new(self.scope);
    self.whileScope = Scope:new(self.containerFuncScope);

    self.posVar = self.containerFuncScope:addVariable();
    self.argsVar = self.containerFuncScope:addVariable();
    self.currentUpvaluesVar = self.containerFuncScope:addVariable();
    self.detectGcCollectVar = self.containerFuncScope:addVariable();
    self.returnVar = self.containerFuncScope:addVariable();

    self.upvaluesTable = self.scope:addVariable();
    self.upvaluesReferenceCountsTable = self.scope:addVariable();
    self.allocUpvalFunction = self.scope:addVariable();
    self.currentUpvalId = self.scope:addVariable();

    self.upvaluesProxyFunctionVar = self.scope:addVariable();
    self.upvaluesGcFunctionVar = self.scope:addVariable();
    self.freeUpvalueFunc = self.scope:addVariable();

    self.createClosureVars = {};
    self.createVarargClosureVar = self.scope:addVariable();
    local createClosureScope = Scope:new(self.scope);
    local createClosurePosArg = createClosureScope:addVariable();
    local createClosureUpvalsArg = createClosureScope:addVariable();
    local createClosureProxyObject = createClosureScope:addVariable();
    local createClosureFuncVar = createClosureScope:addVariable();

    local createClosureSubScope = Scope:new(createClosureScope);

    local upvalEntries = {};
    local upvalueIds = {};
    self.getUpvalueId = function(self, scope, id)
        local expression;
        local scopeFuncDepth = self.scopeFunctionDepths[scope];
        if(scopeFuncDepth == 0) then
            if upvalueIds[id] then
                return upvalueIds[id];
            end
            expression = Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.allocUpvalFunction), {});
        else
            require("logger"):error("Unresolved Upvalue, this error should not occur!");
        end
        table.insert(upvalEntries, Ast.TableEntry(expression));
        local uid = #upvalEntries;
        upvalueIds[id] = uid;
        return uid;
    end

    createClosureSubScope:addReferenceToHigherScope(self.scope, self.containerFuncVar);
    createClosureSubScope:addReferenceToHigherScope(createClosureScope, createClosurePosArg)
    createClosureSubScope:addReferenceToHigherScope(createClosureScope, createClosureUpvalsArg, 1)
    createClosureScope:addReferenceToHigherScope(self.scope, self.upvaluesProxyFunctionVar)
    createClosureSubScope:addReferenceToHigherScope(createClosureScope, createClosureProxyObject);

    self:compileTopNode(ast);

    local functionNodeAssignments = {
        {
            var = Ast.AssignmentVariable(self.scope, self.containerFuncVar),
            val = Ast.FunctionLiteralExpression({
                Ast.VariableExpression(self.containerFuncScope, self.posVar),
                Ast.VariableExpression(self.containerFuncScope, self.argsVar),
                Ast.VariableExpression(self.containerFuncScope, self.currentUpvaluesVar),
                Ast.VariableExpression(self.containerFuncScope, self.detectGcCollectVar)
            }, self:emitContainerFuncBody());
        }, {
            var = Ast.AssignmentVariable(self.scope, self.createVarargClosureVar),
            val = Ast.FunctionLiteralExpression({
                    Ast.VariableExpression(createClosureScope, createClosurePosArg),
                    Ast.VariableExpression(createClosureScope, createClosureUpvalsArg),
                },
                Ast.Block({
                    Ast.LocalVariableDeclaration(createClosureScope, {
                        createClosureProxyObject
                    }, {
                        Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.upvaluesProxyFunctionVar), {
                            Ast.VariableExpression(createClosureScope, createClosureUpvalsArg)
                        })
                    }),
                    Ast.LocalVariableDeclaration(createClosureScope, {createClosureFuncVar},{
                        Ast.FunctionLiteralExpression({
                            Ast.VarargExpression();
                        },
                        Ast.Block({
                            Ast.ReturnStatement{
                                Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.containerFuncVar), {
                                    Ast.VariableExpression(createClosureScope, createClosurePosArg),
                                    Ast.TableConstructorExpression({Ast.TableEntry(Ast.VarargExpression())}),
                                    Ast.VariableExpression(createClosureScope, createClosureUpvalsArg),
                                    Ast.VariableExpression(createClosureScope, createClosureProxyObject)
                                })
                            }
                        }, createClosureSubScope)
                        );
                    });
                    Ast.ReturnStatement{Ast.VariableExpression(createClosureScope, createClosureFuncVar)};
                }, createClosureScope)
            );
        }, {
            var = Ast.AssignmentVariable(self.scope, self.upvaluesTable),
            val = Ast.TableConstructorExpression({}),
        }, {
            var = Ast.AssignmentVariable(self.scope, self.upvaluesReferenceCountsTable),
            val = Ast.TableConstructorExpression({}),
        }, {
            var = Ast.AssignmentVariable(self.scope, self.allocUpvalFunction),
            val = self:createAllocUpvalFunction(),
        }, {
            var = Ast.AssignmentVariable(self.scope, self.currentUpvalId),
            val = Ast.NumberExpression(0),
        }, {
            var = Ast.AssignmentVariable(self.scope, self.upvaluesProxyFunctionVar),
            val = self:createUpvaluesProxyFunc(),
        }, {
            var = Ast.AssignmentVariable(self.scope, self.upvaluesGcFunctionVar),
            val = self:createUpvaluesGcFunc(),
        }, {
            var = Ast.AssignmentVariable(self.scope, self.freeUpvalueFunc),
            val = self:createFreeUpvalueFunc(),
        },
    }

    local tbl = {
        Ast.VariableExpression(self.scope, self.containerFuncVar),
        Ast.VariableExpression(self.scope, self.createVarargClosureVar),
        Ast.VariableExpression(self.scope, self.upvaluesTable),
        Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable),
        Ast.VariableExpression(self.scope, self.allocUpvalFunction),
        Ast.VariableExpression(self.scope, self.currentUpvalId),
        Ast.VariableExpression(self.scope, self.upvaluesProxyFunctionVar),
        Ast.VariableExpression(self.scope, self.upvaluesGcFunctionVar),
        Ast.VariableExpression(self.scope, self.freeUpvalueFunc),
    };
    for i, entry in pairs(self.createClosureVars) do
        table.insert(functionNodeAssignments, entry);
        table.insert(tbl, Ast.VariableExpression(entry.var.scope, entry.var.id));
    end

    util.shuffle(functionNodeAssignments);
    local assignmentStatLhs, assignmentStatRhs = {}, {};
    for i, v in ipairs(functionNodeAssignments) do
        assignmentStatLhs[i] = v.var;
        assignmentStatRhs[i] = v.val;
    end


    -- NEW: Position Shuffler
    local ids = util.shuffle({1, 2, 3, 4, 5, 6, 7});

    local items = {
        Ast.VariableExpression(self.scope, self.envVar),
        Ast.VariableExpression(self.scope, self.unpackVar),
        Ast.VariableExpression(self.scope, self.newproxyVar),
        Ast.VariableExpression(self.scope, self.setmetatableVar),
        Ast.VariableExpression(self.scope, self.getmetatableVar),
        Ast.VariableExpression(self.scope, self.selectVar),
        Ast.VariableExpression(self.scope, argVar),
    }

    local astItems = {
        Ast.OrExpression(Ast.AndExpression(Ast.VariableExpression(newGlobalScope, getfenvVar), Ast.FunctionCallExpression(Ast.VariableExpression(newGlobalScope, getfenvVar), {})), Ast.VariableExpression(newGlobalScope, envVar));
        Ast.OrExpression(Ast.VariableExpression(newGlobalScope, unpackVar), Ast.IndexExpression(Ast.VariableExpression(newGlobalScope, tableVar), Ast.StringExpression("unpack")));
        Ast.VariableExpression(newGlobalScope, newproxyVar);
        Ast.VariableExpression(newGlobalScope, setmetatableVar);
        Ast.VariableExpression(newGlobalScope, getmetatableVar);
        Ast.VariableExpression(newGlobalScope, selectVar);
        Ast.TableConstructorExpression({
            Ast.TableEntry(Ast.VarargExpression());
        })
    }

    local functionNode = Ast.FunctionLiteralExpression({
      items[ids[1]], items[ids[2]], items[ids[3]], items[ids[4]],
      items[ids[5]], items[ids[6]], items[ids[7]],
      unpack(util.shuffle(tbl))
    }, Ast.Block({
        Ast.AssignmentStatement(assignmentStatLhs, assignmentStatRhs);
        Ast.ReturnStatement{
            Ast.FunctionCallExpression(Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.createVarargClosureVar), {
                    Ast.NumberExpression(self.startBlockId);
                    Ast.TableConstructorExpression(upvalEntries);
                }), {Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.unpackVar), {Ast.VariableExpression(self.scope, argVar)})});
        }
    }, self.scope));

    return Ast.TopNode(Ast.Block({
        Ast.ReturnStatement{Ast.FunctionCallExpression(functionNode, {
            astItems[ids[1]], astItems[ids[2]], astItems[ids[3]], astItems[ids[4]],
            astItems[ids[5]], astItems[ids[6]], astItems[ids[7]],
        })};
    }, psc), newGlobalScope);
end

function Compiler:getCreateClosureVar(argCount)
    if not self.createClosureVars[argCount] then
        local var = Ast.AssignmentVariable(self.scope, self.scope:addVariable());
        local createClosureScope = Scope:new(self.scope);
        local createClosureSubScope = Scope:new(createClosureScope);

        local createClosurePosArg = createClosureScope:addVariable();
        local createClosureUpvalsArg = createClosureScope:addVariable();
        local createClosureProxyObject = createClosureScope:addVariable();
        local createClosureFuncVar = createClosureScope:addVariable();

        createClosureSubScope:addReferenceToHigherScope(self.scope, self.containerFuncVar);
        createClosureSubScope:addReferenceToHigherScope(createClosureScope, createClosurePosArg)
        createClosureSubScope:addReferenceToHigherScope(createClosureScope, createClosureUpvalsArg, 1)
        createClosureScope:addReferenceToHigherScope(self.scope, self.upvaluesProxyFunctionVar)
        createClosureSubScope:addReferenceToHigherScope(createClosureScope, createClosureProxyObject);

        local  argsTb, argsTb2 = {}, {};
        for i = 1, argCount do
            local arg = createClosureSubScope:addVariable()
            argsTb[i] = Ast.VariableExpression(createClosureSubScope, arg);
            argsTb2[i] = Ast.TableEntry(Ast.VariableExpression(createClosureSubScope, arg));
        end

        local val = Ast.FunctionLiteralExpression({
            Ast.VariableExpression(createClosureScope, createClosurePosArg),
            Ast.VariableExpression(createClosureScope, createClosureUpvalsArg),
        }, Ast.Block({
                Ast.LocalVariableDeclaration(createClosureScope, {
                    createClosureProxyObject
                }, {
                    Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.upvaluesProxyFunctionVar), {
                        Ast.VariableExpression(createClosureScope, createClosureUpvalsArg)
                    })
                }),
                Ast.LocalVariableDeclaration(createClosureScope, {createClosureFuncVar},{
                    Ast.FunctionLiteralExpression(argsTb,
                    Ast.Block({
                        Ast.ReturnStatement{
                            Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.containerFuncVar), {
                                Ast.VariableExpression(createClosureScope, createClosurePosArg),
                                Ast.TableConstructorExpression(argsTb2),
                                Ast.VariableExpression(createClosureScope, createClosureUpvalsArg),
                                Ast.VariableExpression(createClosureScope, createClosureProxyObject)
                            })
                        }
                    }, createClosureSubScope)
                    );
                });
                Ast.ReturnStatement{Ast.VariableExpression(createClosureScope, createClosureFuncVar)}
            }, createClosureScope)
        );
        self.createClosureVars[argCount] = {
            var = var,
            val = val,
        }
    end


    local var = self.createClosureVars[argCount].var;
    return var.scope, var.id;
end

return Compiler;
`,"prometheus.compiler.compile_core":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- compile_core.lua
-- This Script contains the core compilation functions: compileTopNode, compileFunction, compileBlock,
-- compileStatement, and compileExpression

local compileTop = require("prometheus.compiler.compile_top");
local statementHandlers = require("prometheus.compiler.statements");
local expressionHandlers = require("prometheus.compiler.expressions");
local Ast = require("prometheus.ast");
local logger = require("logger");

return function(Compiler)
    compileTop(Compiler);

    function Compiler:compileStatement(statement, funcDepth)
        local handler = statementHandlers[statement.kind];
        if handler then
            handler(self, statement, funcDepth);
            return;
        end
        logger:error(string.format("%s is not a compileable statement!", statement.kind));
    end

    function Compiler:compileExpression(expression, funcDepth, numReturns)
        local handler = expressionHandlers[expression.kind];
        if handler then
            return handler(self, expression, funcDepth, numReturns);
        end
        logger:error(string.format("%s is not an compliable expression!", expression.kind));
    end
end
`,"prometheus.compiler.compile_top":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- compile_top.lua
--
-- This Script contains the compilation of the top node, function, and block.

local Ast = require("prometheus.ast");
local util = require("prometheus.util");
local visitast = require("prometheus.visitast");

local lookupify = util.lookupify;
local AstKind = Ast.AstKind;

return function(Compiler)
    function Compiler:compileTopNode(node)
        local startBlock = self:createBlock();
        local scope = startBlock.scope;
        self.startBlockId = startBlock.id;
        self:setActiveBlock(startBlock);

        local varAccessLookup = lookupify{
            AstKind.AssignmentVariable,
            AstKind.VariableExpression,
            AstKind.FunctionDeclaration,
            AstKind.LocalFunctionDeclaration,
        }

        local functionLookup = lookupify{
            AstKind.FunctionDeclaration,
            AstKind.LocalFunctionDeclaration,
            AstKind.FunctionLiteralExpression,
            AstKind.TopNode,
        }
        visitast(node, function(node, data)
            if node.kind == AstKind.Block then
                node.scope.__depth = data.functionData.depth;
            end

            if varAccessLookup[node.kind] then
                if not node.scope.isGlobal then
                    if node.scope.__depth < data.functionData.depth then
                        if not self:isUpvalue(node.scope, node.id) then
                            self:makeUpvalue(node.scope, node.id);
                        end
                    end
                end
            end
        end, nil, nil)

        self.varargReg = self:allocRegister(true);
        scope:addReferenceToHigherScope(self.containerFuncScope, self.argsVar);
        scope:addReferenceToHigherScope(self.scope, self.selectVar);
        scope:addReferenceToHigherScope(self.scope, self.unpackVar);
        self:addStatement(self:setRegister(scope, self.varargReg, Ast.VariableExpression(self.containerFuncScope, self.argsVar)), {self.varargReg}, {}, false);

        self:compileBlock(node.body, 0);
        if(self.activeBlock.advanceToNextBlock) then
            self:addStatement(self:setPos(self.activeBlock.scope, nil), {self.POS_REGISTER}, {}, false);
            self:addStatement(self:setReturn(self.activeBlock.scope, Ast.TableConstructorExpression({})), {self.RETURN_REGISTER}, {}, false)
            self.activeBlock.advanceToNextBlock = false;
        end

        self:resetRegisters();
    end

    function Compiler:compileFunction(node, funcDepth)
        funcDepth = funcDepth + 1;
        local oldActiveBlock = self.activeBlock;

        local upperVarargReg = self.varargReg;
        self.varargReg = nil;

        local upvalueExpressions = {};
        local upvalueIds = {};
        local usedRegs = {};

        local oldGetUpvalueId = self.getUpvalueId;
        self.getUpvalueId = function(self, scope, id)
            if(not upvalueIds[scope]) then
                upvalueIds[scope] = {};
            end
            if(upvalueIds[scope][id]) then
                return upvalueIds[scope][id];
            end
            local scopeFuncDepth = self.scopeFunctionDepths[scope];
            local expression;
            if(scopeFuncDepth == funcDepth) then
                oldActiveBlock.scope:addReferenceToHigherScope(self.scope, self.allocUpvalFunction);
                expression = Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.allocUpvalFunction), {});
            elseif(scopeFuncDepth == funcDepth - 1) then
                local varReg = self:getVarRegister(scope, id, scopeFuncDepth, nil);
                expression = self:register(oldActiveBlock.scope, varReg);
                table.insert(usedRegs, varReg);
            else
                local higherId = oldGetUpvalueId(self, scope, id);
                oldActiveBlock.scope:addReferenceToHigherScope(self.containerFuncScope, self.currentUpvaluesVar);
                expression = Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.currentUpvaluesVar), Ast.NumberExpression(higherId));
            end
            table.insert(upvalueExpressions, Ast.TableEntry(expression));
            local uid = #upvalueExpressions;
            upvalueIds[scope][id] = uid;
            return uid;
        end

        local block = self:createBlock();
        self:setActiveBlock(block);
        local scope = self.activeBlock.scope;
        self:pushRegisterUsageInfo();
        for i, arg in ipairs(node.args) do
            if(arg.kind == AstKind.VariableExpression) then
                if(self:isUpvalue(arg.scope, arg.id)) then
                    scope:addReferenceToHigherScope(self.scope, self.allocUpvalFunction);
                    local argReg = self:getVarRegister(arg.scope, arg.id, funcDepth, nil);
                    self:addStatement(self:setRegister(scope, argReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.allocUpvalFunction), {})), {argReg}, {}, false);
                    self:addStatement(self:setUpvalueMember(scope, self:register(scope, argReg), Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.argsVar), Ast.NumberExpression(i))), {}, {argReg}, true);
                else
                    local argReg = self:getVarRegister(arg.scope, arg.id, funcDepth, nil);
                    scope:addReferenceToHigherScope(self.containerFuncScope, self.argsVar);
                    self:addStatement(self:setRegister(scope, argReg, Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.argsVar), Ast.NumberExpression(i))), {argReg}, {}, false);
                end
            else
                self.varargReg = self:allocRegister(true);
                scope:addReferenceToHigherScope(self.containerFuncScope, self.argsVar);
                scope:addReferenceToHigherScope(self.scope, self.selectVar);
                scope:addReferenceToHigherScope(self.scope, self.unpackVar);
                self:addStatement(self:setRegister(scope, self.varargReg, Ast.TableConstructorExpression({
                    Ast.TableEntry(Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.selectVar), {
                        Ast.NumberExpression(i);
                        Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.unpackVar), {
                            Ast.VariableExpression(self.containerFuncScope, self.argsVar),
                        });
                    })),
                })), {self.varargReg}, {}, false);
            end
        end

        self:compileBlock(node.body, funcDepth);
        if(self.activeBlock.advanceToNextBlock) then
            self:addStatement(self:setPos(self.activeBlock.scope, nil), {self.POS_REGISTER}, {}, false);
            self:addStatement(self:setReturn(self.activeBlock.scope, Ast.TableConstructorExpression({})), {self.RETURN_REGISTER}, {}, false);
            self.activeBlock.advanceToNextBlock = false;
        end

        if(self.varargReg) then
            self:freeRegister(self.varargReg, true);
        end
        self.varargReg = upperVarargReg;
        self.getUpvalueId = oldGetUpvalueId;

        self:popRegisterUsageInfo();
        self:setActiveBlock(oldActiveBlock);

        local scope = self.activeBlock.scope;

        local retReg = self:allocRegister(false);

        local isVarargFunction = #node.args > 0 and node.args[#node.args].kind == AstKind.VarargExpression;

        local retrieveExpression
        if isVarargFunction then
            scope:addReferenceToHigherScope(self.scope, self.createVarargClosureVar);
            retrieveExpression = Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.createVarargClosureVar), {
                Ast.NumberExpression(block.id),
                Ast.TableConstructorExpression(upvalueExpressions)
            });
        else
            local varScope, var = self:getCreateClosureVar(#node.args + math.random(0, 5));
            scope:addReferenceToHigherScope(varScope, var);
            retrieveExpression = Ast.FunctionCallExpression(Ast.VariableExpression(varScope, var), {
                Ast.NumberExpression(block.id),
                Ast.TableConstructorExpression(upvalueExpressions)
            });
        end

        self:addStatement(self:setRegister(scope, retReg, retrieveExpression), {retReg}, usedRegs, false);
        return retReg;
    end

    function Compiler:compileBlock(block, funcDepth)
        for i, stat in ipairs(block.statements) do
            self:compileStatement(stat, funcDepth);
        end

        local scope = self.activeBlock.scope;
        for id, name in ipairs(block.scope.variables) do
            local varReg = self:getVarRegister(block.scope, id, funcDepth, nil);
            if self:isUpvalue(block.scope, id) then
                scope:addReferenceToHigherScope(self.scope, self.freeUpvalueFunc);
                self:addStatement(self:setRegister(scope, varReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.freeUpvalueFunc), {
                    self:register(scope, varReg)
                })), {varReg}, {varReg}, false);
            else
                self:addStatement(self:setRegister(scope, varReg, Ast.NilExpression()), {varReg}, {}, false);
            end
            self:freeRegister(varReg, true);
        end
    end
end

`,"prometheus.compiler.constants":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- constants.lua
--
-- This Script contains the compiler constants shared across modules.

return {
    MAX_REGS = 100,
    MAX_REGS_MUL = 0,
}

`,"prometheus.compiler.emit":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- emit.lua
--
-- This Script contains the container function body emission for the compiler.

local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");
local util = require("prometheus.util");
local constants = require("prometheus.compiler.constants");
local AstKind = Ast.AstKind;

local MAX_REGS = constants.MAX_REGS;

return function(Compiler)
    local function hasAnyEntries(tbl)
        return type(tbl) == "table" and next(tbl) ~= nil;
    end

    local function unionLookupTables(a, b)
        local out = {};
        for k, v in pairs(a or {}) do
            out[k] = v;
        end
        for k, v in pairs(b or {}) do
            out[k] = v;
        end
        return out;
    end

    local function canMergeParallelAssignmentStatements(statA, statB)
        if type(statA) ~= "table" or type(statB) ~= "table" then
            return false;
        end

        if statA.usesUpvals or statB.usesUpvals then
            return false;
        end

        local a = statA.statement;
        local b = statB.statement;
        if type(a) ~= "table" or type(b) ~= "table" then
            return false;
        end
        if a.kind ~= AstKind.AssignmentStatement or b.kind ~= AstKind.AssignmentStatement then
            return false;
        end

        if type(a.lhs) ~= "table" or type(a.rhs) ~= "table" or type(b.lhs) ~= "table" or type(b.rhs) ~= "table" then
            return false;
        end

        if #a.lhs ~= #a.rhs or #b.lhs ~= #b.rhs then
            return false;
        end

        -- Avoid merging vararg/call assignments because they can affect multi-return behavior.
        local function hasUnsafeRhs(rhsList)
            for _, rhsExpr in ipairs(rhsList) do
                if type(rhsExpr) ~= "table" then
                    return true;
                end
                local kind = rhsExpr.kind;
                if kind == AstKind.FunctionCallExpression or kind == AstKind.PassSelfFunctionCallExpression or kind == AstKind.VarargExpression then
                    return true;
                end
            end
            return false;
        end
        if hasUnsafeRhs(a.rhs) or hasUnsafeRhs(b.rhs) then
            return false;
        end

        local aReads = type(statA.reads) == "table" and statA.reads or {};
        local aWrites = type(statA.writes) == "table" and statA.writes or {};
        local bReads = type(statB.reads) == "table" and statB.reads or {};
        local bWrites = type(statB.writes) == "table" and statB.writes or {};

        -- Allow merging even if one statement has no writes (e.g., x = o(x) style assignments)
        -- Only require that at least one of them has writes
        if not hasAnyEntries(aWrites) and not hasAnyEntries(bWrites) then
            return false;
        end

        for r in pairs(aReads) do
            if bWrites[r] then
                return false;
            end
        end

        for r, b in pairs(aWrites) do
            if bWrites[r] or bReads[r] then
                return false;
            end
        end

        return true;
    end

    local function mergeParallelAssignmentStatements(statA, statB)
        local lhs = {};
        local rhs = {};
        local aLhs, bLhs = statA.statement.lhs, statB.statement.lhs;
        local aRhs, bRhs = statA.statement.rhs, statB.statement.rhs;
        for i = 1, #aLhs do lhs[i] = aLhs[i]; end
        for i = 1, #bLhs do lhs[#aLhs + i] = bLhs[i]; end
        for i = 1, #aRhs do rhs[i] = aRhs[i]; end
        for i = 1, #bRhs do rhs[#aRhs + i] = bRhs[i]; end

        return {
            statement = Ast.AssignmentStatement(lhs, rhs),
            writes = unionLookupTables(statA.writes, statB.writes),
            reads = unionLookupTables(statA.reads, statB.reads),
            usesUpvals = statA.usesUpvals or statB.usesUpvals,
        };
    end

    local function mergeAdjacentParallelAssignments(blockstats)
        local merged = {};
        local i = 1;
        while i <= #blockstats do
            local stat = blockstats[i];
            i = i + 1;

            while i <= #blockstats and canMergeParallelAssignmentStatements(stat, blockstats[i]) do
                stat = mergeParallelAssignmentStatements(stat, blockstats[i]);
                i = i + 1;
            end

            table.insert(merged, stat);
        end
        return merged;
    end

    function Compiler:emitContainerFuncBody()
        local blocks = {};

        util.shuffle(self.blocks);

        for i, block in ipairs(self.blocks) do
            local id = block.id;
            local blockstats = block.statements;

            for i = 2, #blockstats do
                local stat = blockstats[i];
                local reads = stat.reads;
                local writes = stat.writes;
                local maxShift = 0;
                local usesUpvals = stat.usesUpvals;
                for shift = 1, i - 1 do
                    local stat2 = blockstats[i - shift];

                    if stat2.usesUpvals and usesUpvals then
                        break;
                    end

                    local reads2 = stat2.reads;
                    local writes2 = stat2.writes;
                    local f = true;

                    for r, b in pairs(reads2) do
                        if(writes[r]) then
                            f = false;
                            break;
                        end
                    end

                    if f then
                        for r, b in pairs(writes2) do
                            if(writes[r]) then
                                f = false;
                                break;
                            end
                            if(reads[r]) then
                                f = false;
                                break;
                            end
                        end
                    end

                    if not f then
                        break
                    end

                    maxShift = shift;
                end

                local shift = math.random(0, maxShift);
                for j = 1, shift do
                    blockstats[i - j], blockstats[i - j + 1] = blockstats[i - j + 1], blockstats[i - j];
                end
            end

            local mergedBlockStats = mergeAdjacentParallelAssignments(blockstats);
            for _=1, 7 do
                mergedBlockStats = mergeAdjacentParallelAssignments(mergedBlockStats);
            end

            blockstats = {};
            for _, stat in ipairs(mergedBlockStats) do
                table.insert(blockstats, stat.statement);
            end

            local block = { id = id, index = i, block = Ast.Block(blockstats, block.scope) }
            table.insert(blocks, block);
            blocks[id] = block;
        end

        table.sort(blocks, function(a, b) return a.id < b.id end);

        -- Build a strict threshold condition between adjacent block IDs.
        -- Using a midpoint avoids exact-id comparisons while preserving dispatch.
        local function buildBlockThresholdCondition(scope, leftId, rightId, useAndOr)
            local bound = math.floor((leftId + rightId) / 2);
            local posExpr = self:pos(scope);
            local boundExpr = Ast.NumberExpression(bound);

            if useAndOr then
                -- Kept for compatibility with caller variations.
                return Ast.LessThanExpression(posExpr, boundExpr);
            else
                local variant = math.random(1, 2);
                if variant == 1 then
                    return Ast.LessThanExpression(posExpr, boundExpr);
                else
                    return Ast.GreaterThanExpression(boundExpr, posExpr);
                end
            end
        end

        -- Build an elseif chain for a range of blocks
        local function buildElseifChain(tb, l, r, pScope)
            -- Handle invalid range by returning an empty block
            if r < l then
                local emptyScope = Scope:new(pScope);
                return Ast.Block({}, emptyScope);
            end

            local len = r - l + 1;

            -- For single block
            if len == 1 then
                tb[l].block.scope:setParent(pScope);
                return tb[l].block;
            end

            -- For small ranges, use elseif chain
            if len <= 4 then
                local ifScope = Scope:new(pScope);
                local elseifs = {};

                -- First block uses the first midpoint threshold
                tb[l].block.scope:setParent(ifScope);
                local firstCondition = buildBlockThresholdCondition(ifScope, tb[l].id, tb[l + 1].id, false);
                local firstBlock = tb[l].block;

                -- Middle blocks use their upper midpoint threshold
                for i = l + 1, r - 1 do
                    tb[i].block.scope:setParent(ifScope);
                    local condition = buildBlockThresholdCondition(ifScope, tb[i].id, tb[i + 1].id, false);
                    table.insert(elseifs, {
                        condition = condition,
                        body = tb[i].block
                    });
                end

                -- Last block becomes else
                tb[r].block.scope:setParent(ifScope);
                local elseBlock = tb[r].block;

                return Ast.Block({
                    Ast.IfStatement(firstCondition, firstBlock, elseifs, elseBlock);
                }, ifScope);
            end

            -- For larger ranges, use binary split with and/or chaining
            local mid = l + math.ceil(len / 2);
            local leftMaxId = tb[mid - 1].id;
            local rightMinId = tb[mid].id;
            -- Float-safe split: any bound strictly between adjacent IDs works.
            -- Midpoint avoids integer-only math.random(min, max) behavior.
            local bound = math.floor((leftMaxId + rightMinId) / 2);
            local ifScope = Scope:new(pScope);

            local lBlock = buildElseifChain(tb, l, mid - 1, ifScope);
            local rBlock = buildElseifChain(tb, mid, r, ifScope);

            -- Randomly choose between different condition styles
            local condStyle = math.random(1, 3);
            local condition;
            local trueBlock, falseBlock;

            if condStyle == 1 then
                -- pos < bound
                condition = Ast.LessThanExpression(self:pos(ifScope), Ast.NumberExpression(bound));
                trueBlock, falseBlock = lBlock, rBlock;
            elseif condStyle == 2 then
                -- bound > pos
                condition = Ast.GreaterThanExpression(Ast.NumberExpression(bound), self:pos(ifScope));
                trueBlock, falseBlock = lBlock, rBlock;
            else
                -- Equivalent split using strict > with branches reversed.
                condition = Ast.GreaterThanExpression(self:pos(ifScope), Ast.NumberExpression(bound));
                trueBlock, falseBlock = rBlock, lBlock;
            end

            return Ast.Block({
                Ast.IfStatement(condition, trueBlock, {}, falseBlock);
            }, ifScope);
        end

        local whileBody = buildElseifChain(blocks, 1, #blocks, self.containerFuncScope);
        if self.whileScope then
            -- Ensure whileScope is properly connected
            self.whileScope:setParent(self.containerFuncScope);
        end

        self.whileScope:addReferenceToHigherScope(self.containerFuncScope, self.returnVar, 1);
        self.whileScope:addReferenceToHigherScope(self.containerFuncScope, self.posVar);

        self.containerFuncScope:addReferenceToHigherScope(self.scope, self.unpackVar);

        local declarations = {
            self.returnVar,
        }

        for i, var in pairs(self.registerVars) do
            if(i ~= MAX_REGS) then
                table.insert(declarations, var);
            end
        end

        local stats = {}

        if self.maxUsedRegister >= MAX_REGS then
            table.insert(stats, Ast.LocalVariableDeclaration(self.containerFuncScope, {self.registerVars[MAX_REGS]}, {Ast.TableConstructorExpression({})}));
        end

        table.insert(stats, Ast.LocalVariableDeclaration(self.containerFuncScope, util.shuffle(declarations), {}));

        table.insert(stats, Ast.WhileStatement(whileBody, Ast.VariableExpression(self.containerFuncScope, self.posVar)));


        table.insert(stats, Ast.AssignmentStatement({
            Ast.AssignmentVariable(self.containerFuncScope, self.posVar)
        }, {
            Ast.LenExpression(Ast.VariableExpression(self.containerFuncScope, self.detectGcCollectVar))
        }));

        table.insert(stats, Ast.ReturnStatement{
            Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.unpackVar), {
                Ast.VariableExpression(self.containerFuncScope, self.returnVar)
            });
        });

        return Ast.Block(stats, self.containerFuncScope);
    end
end
`,"prometheus.compiler.expressions.and":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- and.lua
--
-- This Script contains the expression handler for the AndExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local posState = self.registers[self.POS_REGISTER];
    self.registers[self.POS_REGISTER] = self.VAR_REGISTER;

    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i ~= 1 then
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end

    local resReg = regs[1];
    local tmpReg;

    if posState then
        tmpReg = self:allocRegister(false);
        self:addStatement(self:copyRegisters(scope, {tmpReg}, {self.POS_REGISTER}), {tmpReg}, {self.POS_REGISTER}, false);
    end

    local lhsReg = self:compileExpression(expression.lhs, funcDepth, 1)[1];
    if expression.rhs.isConstant then
        local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];
        self:addStatement(self:setRegister(scope, resReg, Ast.AndExpression(self:register(scope, lhsReg), self:register(scope, rhsReg))), {resReg}, {lhsReg, rhsReg}, false);
        if tmpReg then
            self:freeRegister(tmpReg, false);
        end
        self:freeRegister(lhsReg, false);
        self:freeRegister(rhsReg, false);
        return regs;
    end

    local block1, block2 = self:createBlock(), self:createBlock();
    self:addStatement(self:copyRegisters(scope, {resReg}, {lhsReg}), {resReg}, {lhsReg}, false);
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(scope, lhsReg), Ast.NumberExpression(block1.id)), Ast.NumberExpression(block2.id))), {self.POS_REGISTER}, {lhsReg}, false);
    self:freeRegister(lhsReg, false);
    do
        self:setActiveBlock(block1);
        scope = block1.scope;
        local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];
        self:addStatement(self:copyRegisters(scope, {resReg}, {rhsReg}), {resReg}, {rhsReg}, false);
        self:freeRegister(rhsReg, false);

        self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(block2.id)), {self.POS_REGISTER}, {}, false);
    end

    self.registers[self.POS_REGISTER] = posState;

    self:setActiveBlock(block2);
    scope = block2.scope;

    if tmpReg then
        self:addStatement(self:copyRegisters(scope, {self.POS_REGISTER}, {tmpReg}), {self.POS_REGISTER}, {tmpReg}, false);
        self:freeRegister(tmpReg, false);
    end

    return regs;
end;
`,"prometheus.compiler.expressions.binary":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- binary.lua
--
-- This Script contains the expression handler for the Binary operations (Add, Sub, Mul, Div, etc.).

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            local lhsReg = self:compileExpression(expression.lhs, funcDepth, 1)[1];
            local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];

            local binaryExpr = Ast[expression.kind](self:register(scope, lhsReg), self:register(scope, rhsReg));
            self:addStatement(self:setRegister(scope, regs[i], binaryExpr), {regs[i]}, {lhsReg, rhsReg}, true);
            self:freeRegister(rhsReg, false);
            self:freeRegister(lhsReg, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;
`,"prometheus.compiler.expressions.boolean":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- boolean.lua
--
-- This Script contains the expression handler for the BooleanExpression.

local Ast = require("prometheus.ast");

local expressionEvaluators = {
    [Ast.GreaterThanExpression] = function(left, right)
        return left > right
    end,
    [Ast.LessThanExpression] = function(left, right)
        return left < right
    end,
    [Ast.GreaterThanOrEqualsExpression] = function(left, right)
        return left >= right
    end,
    [Ast.LessThanOrEqualsExpression] = function(left, right)
        return left <= right
    end,
    [Ast.NotEqualsExpression] = function(left, right)
        return left ~= right
    end,
}

local function createRandomASTCFlowExpression(resultBool)
    local expTB = {
        Ast.GreaterThanExpression,
        Ast.LessThanExpression,
        Ast.GreaterThanOrEqualsExpression,
        Ast.LessThanOrEqualsExpression,
        Ast.NotEqualsExpression
    }

    local leftInt, rightInt, boolResult, randomExp
    repeat
        randomExp = expTB[math.random(1, #expTB)]
        leftInt = Ast.NumberExpression(math.random(1, 2^24))
        rightInt = Ast.NumberExpression(math.random(1, 2^24))
        boolResult = expressionEvaluators[randomExp](leftInt.value, rightInt.value)
    until boolResult == resultBool

    return randomExp(leftInt, rightInt, false)
end

return function(self, expression, _, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            self:addStatement(self:setRegister(scope, regs[i], createRandomASTCFlowExpression(expression.value)), {regs[i]}, {}, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;
`,"prometheus.compiler.expressions.function_call":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- function_call.lua
--
-- This Script contains the expression handler for the FunctionCallExpression.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local baseReg = self:compileExpression(expression.base, funcDepth, 1)[1];

    local retRegs = {};
    local returnAll = numReturns == self.RETURN_ALL;
    if returnAll then
        retRegs[1] = self:allocRegister(false);
    else
        for i = 1, numReturns do
            retRegs[i] = self:allocRegister(false);
        end
    end

    local regs = {};
    local args = {};
    for i, expr in ipairs(expression.args) do
        if i == #expression.args and (expr.kind == AstKind.FunctionCallExpression or expr.kind == AstKind.PassSelfFunctionCallExpression or expr.kind == AstKind.VarargExpression) then
            local reg = self:compileExpression(expr, funcDepth, self.RETURN_ALL)[1];
            table.insert(args, Ast.FunctionCallExpression(
                self:unpack(scope),
                {self:register(scope, reg)}));
            table.insert(regs, reg);
        else
            local reg = self:compileExpression(expr, funcDepth, 1)[1];
            table.insert(args, self:register(scope, reg));
            table.insert(regs, reg);
        end
    end

    if returnAll then
        self:addStatement(self:setRegister(scope, retRegs[1], Ast.TableConstructorExpression{Ast.TableEntry(Ast.FunctionCallExpression(self:register(scope, baseReg), args))}), {retRegs[1]}, {baseReg, unpack(regs)}, true);
    else
        if numReturns > 1 then
            local tmpReg = self:allocRegister(false);

            self:addStatement(self:setRegister(scope, tmpReg, Ast.TableConstructorExpression{Ast.TableEntry(Ast.FunctionCallExpression(self:register(scope, baseReg), args))}), {tmpReg}, {baseReg, unpack(regs)}, true);


            for i, reg in ipairs(retRegs) do
                self:addStatement(self:setRegister(scope, reg, Ast.IndexExpression(self:register(scope, tmpReg), Ast.NumberExpression(i))), {reg}, {tmpReg}, false);
            end

            self:freeRegister(tmpReg, false);
        else
            self:addStatement(self:setRegister(scope, retRegs[1], Ast.FunctionCallExpression(self:register(scope, baseReg), args)), {retRegs[1]}, {baseReg, unpack(regs)}, true);
        end
    end

    self:freeRegister(baseReg, false);
    for i, reg in ipairs(regs) do
        self:freeRegister(reg, false);
    end

    return retRegs;
end;
`,"prometheus.compiler.expressions.function_literal":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- function_literal.lua
--
-- This Script contains the expression handler for the FunctionLiteralExpression

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        if i == 1 then
            regs[i] = self:compileFunction(expression, funcDepth);
        else
            regs[i] = self:allocRegister();
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;

`,"prometheus.compiler.expressions.if_else":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- if_else.lua
--
-- This Script contains the statement handler for the IfElseExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
	local scope = self.activeBlock.scope;
	local posState = self.registers[self.POS_REGISTER];
    self.registers[self.POS_REGISTER] = self.VAR_REGISTER;

	local regs = {};
	for i = 1, numReturns do
		regs[i] = self:allocRegister();
		if i ~= 1 then
			self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
		end
	end

	local resReg = regs[1];
	local tmpReg;

	if posState then
        tmpReg = self:allocRegister(false);
        self:addStatement(self:copyRegisters(scope, {tmpReg}, {self.POS_REGISTER}), {tmpReg}, {self.POS_REGISTER}, false);
    end

	local conditionReg = self:compileExpression(expression.condition, funcDepth, 1)[1];

	local finalBlock = self:createBlock();
	local nextBlock = self:createBlock();
	local innerBlock = self:createBlock();

	self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(scope, conditionReg), Ast.NumberExpression(innerBlock.id)), Ast.NumberExpression(nextBlock.id))), {self.POS_REGISTER}, {conditionReg}, false);
	self:freeRegister(conditionReg, false);

	self:setActiveBlock(innerBlock);
	scope = innerBlock.scope;

	local trueReg = self:compileExpression(expression.true_value, funcDepth, 1)[1];
	self:addStatement(self:copyRegisters(scope, {resReg}, {trueReg}), {resReg}, {trueReg}, false);
	self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(finalBlock.id)), {self.POS_REGISTER}, {}, false);

	for _, elif in ipairs(expression.elseifs) do
		self:setActiveBlock(nextBlock);
		conditionReg = self:compileExpression(elif.condition, funcDepth, 1)[1];
		local elifBlock = self:createBlock();
		nextBlock = self:createBlock();
		local elifScope = self.activeBlock.scope;

		self:addStatement(self:setRegister(elifScope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(elifScope, conditionReg), Ast.NumberExpression(elifBlock.id)), Ast.NumberExpression(nextBlock.id))), {self.POS_REGISTER}, {conditionReg}, false);
		self:freeRegister(conditionReg, false);

		self:setActiveBlock(elifBlock);
		elifScope = elifBlock.scope;
		local valueReg = self:compileExpression(elif.value, funcDepth, 1)[1];
		self:addStatement(self:copyRegisters(elifScope, {resReg}, {valueReg}), {resReg}, {valueReg}, false);
		self:addStatement(self:setRegister(elifScope, self.POS_REGISTER, Ast.NumberExpression(finalBlock.id)), {self.POS_REGISTER}, {}, false);
	end

	self:setActiveBlock(nextBlock);
	scope = self.activeBlock.scope;
	local falseReg = self:compileExpression(expression.false_value, funcDepth, 1)[1];
	self:addStatement(self:copyRegisters(scope, {resReg}, {falseReg}), {resReg}, {falseReg}, false);
	self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(finalBlock.id)), {self.POS_REGISTER}, {}, false);

	self.registers[self.POS_REGISTER] = posState;

	self:setActiveBlock(finalBlock);
	scope = finalBlock.scope;

    if tmpReg then
        self:addStatement(self:copyRegisters(scope, {self.POS_REGISTER}, {tmpReg}), {self.POS_REGISTER}, {tmpReg}, false);
        self:freeRegister(tmpReg, false);
    end

	return regs;
end`,"prometheus.compiler.expressions.index":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- index.lua
--
-- This Script contains the expression handler for the IndexExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            local baseReg = self:compileExpression(expression.base, funcDepth, 1)[1];
            local indexReg = self:compileExpression(expression.index, funcDepth, 1)[1];



            self:addStatement(self:setRegister(scope, regs[i], Ast.IndexExpression(self:register(scope, baseReg), self:register(scope, indexReg))), {regs[i]}, {baseReg, indexReg}, true);

            self:freeRegister(baseReg, false);
            self:freeRegister(indexReg, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;
`,"prometheus.compiler.expressions.len":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- len.lua
--
-- This Script contains the expression handler for the LenExpression

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];

            self:addStatement(self:setRegister(scope, regs[i], Ast.LenExpression(self:register(scope, rhsReg))), {regs[i]}, {rhsReg}, true);
            self:freeRegister(rhsReg, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;

`,"prometheus.compiler.expressions.negate":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- negate.lua
--
-- This Script contains the expression handler for the NegateExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];

            self:addStatement(self:setRegister(scope, regs[i], Ast.NegateExpression(self:register(scope, rhsReg))), {regs[i]}, {rhsReg}, true);
            self:freeRegister(rhsReg, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;

`,"prometheus.compiler.expressions.nil":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- nil.lua
--
-- This Script contains the expression handler for the NilExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
    end
    return regs;
end;

`,"prometheus.compiler.expressions.not":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- not.lua
--
-- This Script contains the expression handler for the NotExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];

            self:addStatement(self:setRegister(scope, regs[i], Ast.NotExpression(self:register(scope, rhsReg))), {regs[i]}, {rhsReg}, false);
            self:freeRegister(rhsReg, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;

`,"prometheus.compiler.expressions.number":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- number.lua
--
-- This Script contains the expression handler for the NumberExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            self:addStatement(self:setRegister(scope, regs[i], Ast.NumberExpression(expression.value)), {regs[i]}, {}, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;

`,"prometheus.compiler.expressions.or":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- or.lua
--
-- This Script contains the expression handler for the OrExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local posState = self.registers[self.POS_REGISTER];
    self.registers[self.POS_REGISTER] = self.VAR_REGISTER;

    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i ~= 1 then
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end

    local resReg = regs[1];
    local tmpReg;

    if posState then
        tmpReg = self:allocRegister(false);
        self:addStatement(self:copyRegisters(scope, {tmpReg}, {self.POS_REGISTER}), {tmpReg}, {self.POS_REGISTER}, false);
    end

    local lhsReg = self:compileExpression(expression.lhs, funcDepth, 1)[1];
    if expression.rhs.isConstant then
        local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];
        self:addStatement(self:setRegister(scope, resReg, Ast.OrExpression(self:register(scope, lhsReg), self:register(scope, rhsReg))), {resReg}, {lhsReg, rhsReg}, false);
        if tmpReg then
            self:freeRegister(tmpReg, false);
        end
        self:freeRegister(lhsReg, false);
        self:freeRegister(rhsReg, false);
        return regs;
    end

    local block1, block2 = self:createBlock(), self:createBlock();
    self:addStatement(self:copyRegisters(scope, {resReg}, {lhsReg}), {resReg}, {lhsReg}, false);
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(scope, lhsReg), Ast.NumberExpression(block2.id)), Ast.NumberExpression(block1.id))), {self.POS_REGISTER}, {lhsReg}, false);
    self:freeRegister(lhsReg, false);

    do
        self:setActiveBlock(block1);
        local scope = block1.scope;
        local rhsReg = self:compileExpression(expression.rhs, funcDepth, 1)[1];
        self:addStatement(self:copyRegisters(scope, {resReg}, {rhsReg}), {resReg}, {rhsReg}, false);
        self:freeRegister(rhsReg, false);


        self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(block2.id)), {self.POS_REGISTER}, {}, false);
    end

    self.registers[self.POS_REGISTER] = posState;

    self:setActiveBlock(block2);
    scope = block2.scope;

    if tmpReg then
        self:addStatement(self:copyRegisters(scope, {self.POS_REGISTER}, {tmpReg}), {self.POS_REGISTER}, {tmpReg}, false);
        self:freeRegister(tmpReg, false);
    end

    return regs;
end;
`,"prometheus.compiler.expressions.pass_self_function_call":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- pass_self_function_call.lua
--
-- This Script contains the expression handler for the PassSelfFunctionCallExpression.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local baseReg = self:compileExpression(expression.base, funcDepth, 1)[1];
    local retRegs = {};
    local returnAll = numReturns == self.RETURN_ALL;
    if returnAll then
        retRegs[1] = self:allocRegister(false);
    else
        for i = 1, numReturns do
            retRegs[i] = self:allocRegister(false);
        end
    end

    local args = { self:register(scope, baseReg) };
    local regs = { baseReg };

    for i, expr in ipairs(expression.args) do
        if i == #expression.args and (expr.kind == AstKind.FunctionCallExpression or expr.kind == AstKind.PassSelfFunctionCallExpression or expr.kind == AstKind.VarargExpression) then
            local reg = self:compileExpression(expr, funcDepth, self.RETURN_ALL)[1];
            table.insert(args, Ast.FunctionCallExpression(
                self:unpack(scope),
                {self:register(scope, reg)}));
            table.insert(regs, reg);
        else
            local reg = self:compileExpression(expr, funcDepth, 1)[1];
            table.insert(args, self:register(scope, reg));
            table.insert(regs, reg);
        end
    end

    if returnAll or numReturns > 1 then
        local tmpReg = self:allocRegister(false);

        self:addStatement(self:setRegister(scope, tmpReg, Ast.StringExpression(expression.passSelfFunctionName)), {tmpReg}, {}, false);
        self:addStatement(self:setRegister(scope, tmpReg, Ast.IndexExpression(self:register(scope, baseReg), self:register(scope, tmpReg))), {tmpReg}, {baseReg, tmpReg}, false);

        if returnAll then
            self:addStatement(self:setRegister(scope, retRegs[1], Ast.TableConstructorExpression{Ast.TableEntry(Ast.FunctionCallExpression(self:register(scope, tmpReg), args))}), {retRegs[1]}, {tmpReg, unpack(regs)}, true);
        else
            self:addStatement(self:setRegister(scope, tmpReg, Ast.TableConstructorExpression{Ast.TableEntry(Ast.FunctionCallExpression(self:register(scope, tmpReg), args))}), {tmpReg}, {tmpReg, unpack(regs)}, true);

            for i, reg in ipairs(retRegs) do
                self:addStatement(self:setRegister(scope, reg, Ast.IndexExpression(self:register(scope, tmpReg), Ast.NumberExpression(i))), {reg}, {tmpReg}, false);
            end
        end

        self:freeRegister(tmpReg, false);
    else
        local tmpReg = retRegs[1] or self:allocRegister(false);

        self:addStatement(self:setRegister(scope, tmpReg, Ast.StringExpression(expression.passSelfFunctionName)), {tmpReg}, {}, false);
        self:addStatement(self:setRegister(scope, tmpReg, Ast.IndexExpression(self:register(scope, baseReg), self:register(scope, tmpReg))), {tmpReg}, {baseReg, tmpReg}, false);
        self:addStatement(self:setRegister(scope, retRegs[1], Ast.FunctionCallExpression(self:register(scope, tmpReg), args)), {retRegs[1]}, {baseReg, unpack(regs)}, true);
    end

    for i, reg in ipairs(regs) do
        self:freeRegister(reg, false);
    end

    return retRegs;
end;
`,"prometheus.compiler.expressions.string":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- string.lua
--
-- This Script contains the expression handler for the StringExpression.

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns, 1 do
        regs[i] = self:allocRegister();
        if i == 1 then
            self:addStatement(self:setRegister(scope, regs[i], Ast.StringExpression(expression.value)), {regs[i]}, {}, false);
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;

`,"prometheus.compiler.expressions.table_constructor":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- table_constructor.lua
--
-- This Script contains the expression handler for the TableConstructorExpression.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister();
        if i == 1 then
            local entries = {};
            local entryRegs = {};
            for i, entry in ipairs(expression.entries) do
                if entry.kind == AstKind.TableEntry then
                    local value = entry.value;
                    if i == #expression.entries and (value.kind == AstKind.FunctionCallExpression or value.kind == AstKind.PassSelfFunctionCallExpression or value.kind == AstKind.VarargExpression) then
                        local reg = self:compileExpression(entry.value, funcDepth, self.RETURN_ALL)[1];
                        table.insert(entries, Ast.TableEntry(Ast.FunctionCallExpression(
                            self:unpack(scope),
                            {self:register(scope, reg)})));
                        table.insert(entryRegs, reg);
                    else
                        local reg = self:compileExpression(entry.value, funcDepth, 1)[1];
                        table.insert(entries, Ast.TableEntry(self:register(scope, reg)));
                        table.insert(entryRegs, reg);
                    end
                else
                    local keyReg = self:compileExpression(entry.key, funcDepth, 1)[1];
                    local valReg = self:compileExpression(entry.value, funcDepth, 1)[1];
                    table.insert(entries, Ast.KeyedTableEntry(self:register(scope, keyReg), self:register(scope, valReg)));
                    table.insert(entryRegs, valReg);
                    table.insert(entryRegs, keyReg);
                end
            end
            self:addStatement(self:setRegister(scope, regs[i], Ast.TableConstructorExpression(entries)), {regs[i]}, entryRegs, false);
            for i, reg in ipairs(entryRegs) do
                self:freeRegister(reg, false);
            end
        else
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;
`,"prometheus.compiler.expressions.vararg":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- vararg.lua
--
-- This Script contains the expression handler for the VarargExpression

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    if numReturns == self.RETURN_ALL then
        return {self.varargReg};
    end
    local regs = {};
    for i = 1, numReturns do
        regs[i] = self:allocRegister(false);
        self:addStatement(self:setRegister(scope, regs[i], Ast.IndexExpression(self:register(scope, self.varargReg), Ast.NumberExpression(i))), {regs[i]}, {self.varargReg}, false);
    end
    return regs;
end;

`,"prometheus.compiler.expressions.variable":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- variable.lua
--
-- This Script contains the expression handler for the VariableExpression

local Ast = require("prometheus.ast");

return function(self, expression, funcDepth, numReturns)
    local scope = self.activeBlock.scope;
    local regs = {};
    for i = 1, numReturns do
        if i == 1 then
            if expression.scope.isGlobal then
                regs[i] = self:allocRegister(false);
                local tmpReg = self:allocRegister(false);
                self:addStatement(self:setRegister(scope, tmpReg, Ast.StringExpression(expression.scope:getVariableName(expression.id))), {tmpReg}, {}, false);
                self:addStatement(self:setRegister(scope, regs[i], Ast.IndexExpression(self:env(scope), self:register(scope, tmpReg))), {regs[i]}, {tmpReg}, true);
                self:freeRegister(tmpReg, false);
            else
                if self.scopeFunctionDepths[expression.scope] == funcDepth then
                    if self:isUpvalue(expression.scope, expression.id) then
                        local reg = self:allocRegister(false);
                        local varReg = self:getVarRegister(expression.scope, expression.id, funcDepth, nil);
                        self:addStatement(self:setRegister(scope, reg, self:getUpvalueMember(scope, self:register(scope, varReg))), {reg}, {varReg}, true);
                        regs[i] = reg;
                    else
                        regs[i] = self:getVarRegister(expression.scope, expression.id, funcDepth, nil);
                    end
                else
                    local reg = self:allocRegister(false);
                    local upvalId = self:getUpvalueId(expression.scope, expression.id);
                    scope:addReferenceToHigherScope(self.containerFuncScope, self.currentUpvaluesVar);
                    self:addStatement(self:setRegister(scope, reg, self:getUpvalueMember(scope, Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.currentUpvaluesVar), Ast.NumberExpression(upvalId)))), {reg}, {}, true);
                    regs[i] = reg;
                end
            end
        else
            regs[i] = self:allocRegister();
            self:addStatement(self:setRegister(scope, regs[i], Ast.NilExpression()), {regs[i]}, {}, false);
        end
    end
    return regs;
end;

`,"prometheus.compiler.expressions":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- expressions.lua
--
-- This Script contains the expression handlers: exports handler table keyed by AstKind.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

local handlers = {};
local expressions = "prometheus.compiler.expressions.";
local function requireExpression(name)
    return require(expressions .. name);
end
handlers[AstKind.StringExpression] = requireExpression("string");
handlers[AstKind.NumberExpression] = requireExpression("number");
handlers[AstKind.BooleanExpression] = requireExpression("boolean");
handlers[AstKind.NilExpression] = requireExpression("nil");
handlers[AstKind.VariableExpression] = requireExpression("variable");
handlers[AstKind.FunctionCallExpression] = requireExpression("function_call");
handlers[AstKind.PassSelfFunctionCallExpression] = requireExpression("pass_self_function_call");
handlers[AstKind.IndexExpression] = requireExpression("index");
handlers[AstKind.NotExpression] = requireExpression("not");
handlers[AstKind.NegateExpression] = requireExpression("negate");
handlers[AstKind.LenExpression] = requireExpression("len");
handlers[AstKind.OrExpression] = requireExpression("or");
handlers[AstKind.AndExpression] = requireExpression("and");
handlers[AstKind.TableConstructorExpression] = requireExpression("table_constructor");
handlers[AstKind.FunctionLiteralExpression] = requireExpression("function_literal");
handlers[AstKind.VarargExpression] = requireExpression("vararg");
handlers[AstKind.IfElseExpression] = requireExpression("if_else");

-- Binary ops share one handler
local binaryHandler = requireExpression("binary");
handlers[AstKind.LessThanExpression] = binaryHandler;
handlers[AstKind.GreaterThanExpression] = binaryHandler;
handlers[AstKind.LessThanOrEqualsExpression] = binaryHandler;
handlers[AstKind.GreaterThanOrEqualsExpression] = binaryHandler;
handlers[AstKind.NotEqualsExpression] = binaryHandler;
handlers[AstKind.EqualsExpression] = binaryHandler;
handlers[AstKind.StrCatExpression] = binaryHandler;
handlers[AstKind.AddExpression] = binaryHandler;
handlers[AstKind.SubExpression] = binaryHandler;
handlers[AstKind.MulExpression] = binaryHandler;
handlers[AstKind.DivExpression] = binaryHandler;
handlers[AstKind.ModExpression] = binaryHandler;
handlers[AstKind.PowExpression] = binaryHandler;

return handlers;

`,"prometheus.compiler.register":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- register.lua
--
-- This Script contains the register management for the compiler.

local Ast = require("prometheus.ast");
local constants = require("prometheus.compiler.constants");
local randomStrings = require("prometheus.randomStrings");

local MAX_REGS = constants.MAX_REGS;

return function(Compiler)
    function Compiler:freeRegister(id, force)
        if force or not (self.registers[id] == self.VAR_REGISTER) then
            self.usedRegisters = self.usedRegisters - 1;
            self.registers[id] = false
        end
    end

    function Compiler:isVarRegister(id)
        return self.registers[id] == self.VAR_REGISTER;
    end

    function Compiler:allocRegister(isVar)
        self.usedRegisters = self.usedRegisters + 1;

        if not isVar then
            if not self.registers[self.POS_REGISTER] then
                self.registers[self.POS_REGISTER] = true;
                return self.POS_REGISTER;
            end

            if not self.registers[self.RETURN_REGISTER] then
                self.registers[self.RETURN_REGISTER] = true;
                return self.RETURN_REGISTER;
            end
        end

        local id = 0;
        if self.usedRegisters < MAX_REGS * constants.MAX_REGS_MUL then
            repeat
                id = math.random(1, MAX_REGS - 1);
            until not self.registers[id];
        else
            repeat
                id = id + 1;
            until not self.registers[id];
        end

        if id > self.maxUsedRegister then
            self.maxUsedRegister = id;
        end

        if(isVar) then
            self.registers[id] = self.VAR_REGISTER;
        else
            self.registers[id] = true
        end
        return id;
    end

    function Compiler:isUpvalue(scope, id)
        return self.upvalVars[scope] and self.upvalVars[scope][id];
    end

    function Compiler:makeUpvalue(scope, id)
        if(not self.upvalVars[scope]) then
            self.upvalVars[scope] = {}
        end
        self.upvalVars[scope][id] = true;
    end

    function Compiler:getVarRegister(scope, id, functionDepth, potentialId)
        if(not self.registersForVar[scope]) then
            self.registersForVar[scope] = {};
            self.scopeFunctionDepths[scope] = functionDepth;
        end

        local reg = self.registersForVar[scope][id];
        if not reg then
            if potentialId and self.registers[potentialId] ~= self.VAR_REGISTER and potentialId ~= self.POS_REGISTER and potentialId ~= self.RETURN_REGISTER then
                self.registers[potentialId] = self.VAR_REGISTER;
                reg = potentialId;
            else
                reg = self:allocRegister(true);
            end
            self.registersForVar[scope][id] = reg;
        end
        return reg;
    end

    function Compiler:getRegisterVarId(id)
        local varId = self.registerVars[id];
        if not varId then
            varId = self.containerFuncScope:addVariable();
            self.registerVars[id] = varId;
        end
        return varId;
    end

    function Compiler:register(scope, id)
        if id == self.POS_REGISTER then
            return self:pos(scope);
        end

        if id == self.RETURN_REGISTER then
            return self:getReturn(scope);
        end

        if id < MAX_REGS then
            local vid = self:getRegisterVarId(id);
            scope:addReferenceToHigherScope(self.containerFuncScope, vid);
            return Ast.VariableExpression(self.containerFuncScope, vid);
        end

        local vid = self:getRegisterVarId(MAX_REGS);
        scope:addReferenceToHigherScope(self.containerFuncScope, vid);
        return Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, vid), Ast.NumberExpression((id - MAX_REGS) + 1));
    end

    function Compiler:registerList(scope, ids)
        local l = {};
        for i, id in ipairs(ids) do
            table.insert(l, self:register(scope, id));
        end
        return l;
    end

    function Compiler:registerAssignment(scope, id)
        if id == self.POS_REGISTER then
            return self:posAssignment(scope);
        end
        if id == self.RETURN_REGISTER then
            return self:returnAssignment(scope);
        end

        if id < MAX_REGS then
            local vid = self:getRegisterVarId(id);
            scope:addReferenceToHigherScope(self.containerFuncScope, vid);
            return Ast.AssignmentVariable(self.containerFuncScope, vid);
        end

        local vid = self:getRegisterVarId(MAX_REGS);
        scope:addReferenceToHigherScope(self.containerFuncScope, vid);
        return Ast.AssignmentIndexing(Ast.VariableExpression(self.containerFuncScope, vid), Ast.NumberExpression((id - MAX_REGS) + 1));
    end

    function Compiler:setRegister(scope, id, val, compundArg)
        if(compundArg) then
            return compundArg(self:registerAssignment(scope, id), val);
        end
        return Ast.AssignmentStatement({
            self:registerAssignment(scope, id)
        }, {
            val
        });
    end

    function Compiler:setRegisters(scope, ids, vals)
        local idStats = {};
        for i, id in ipairs(ids) do
            table.insert(idStats, self:registerAssignment(scope, id));
        end

        return Ast.AssignmentStatement(idStats, vals);
    end

    function Compiler:copyRegisters(scope, to, from)
        local idStats = {};
        local vals = {};
        for i, id in ipairs(to) do
            local fromId = from[i];
            if(fromId ~= id) then
                table.insert(idStats, self:registerAssignment(scope, id));
                table.insert(vals, self:register(scope, fromId));
            end
        end

        if(#idStats > 0 and #vals > 0) then
            return Ast.AssignmentStatement(idStats, vals);
        end
    end

    function Compiler:resetRegisters()
        self.registers = {};
    end

    function Compiler:pos(scope)
        scope:addReferenceToHigherScope(self.containerFuncScope, self.posVar);
        return Ast.VariableExpression(self.containerFuncScope, self.posVar);
    end

    function Compiler:posAssignment(scope)
        scope:addReferenceToHigherScope(self.containerFuncScope, self.posVar);
        return Ast.AssignmentVariable(self.containerFuncScope, self.posVar);
    end

    function Compiler:args(scope)
        scope:addReferenceToHigherScope(self.containerFuncScope, self.argsVar);
        return Ast.VariableExpression(self.containerFuncScope, self.argsVar);
    end

    function Compiler:unpack(scope)
        scope:addReferenceToHigherScope(self.scope, self.unpackVar);
        return Ast.VariableExpression(self.scope, self.unpackVar);
    end

    function Compiler:env(scope)
        scope:addReferenceToHigherScope(self.scope, self.envVar);
        return Ast.VariableExpression(self.scope, self.envVar);
    end

    function Compiler:jmp(scope, to)
        scope:addReferenceToHigherScope(self.containerFuncScope, self.posVar);
        return Ast.AssignmentStatement({Ast.AssignmentVariable(self.containerFuncScope, self.posVar)},{to});
    end

    function Compiler:setPos(scope, val)
        if not val then
            local v = Ast.IndexExpression(self:env(scope), randomStrings.randomStringNode(math.random(12, 14)));
            scope:addReferenceToHigherScope(self.containerFuncScope, self.posVar);
            return Ast.AssignmentStatement({Ast.AssignmentVariable(self.containerFuncScope, self.posVar)}, {v});
        end
        scope:addReferenceToHigherScope(self.containerFuncScope, self.posVar);
        return Ast.AssignmentStatement({Ast.AssignmentVariable(self.containerFuncScope, self.posVar)}, {Ast.NumberExpression(val) or Ast.NilExpression()});
    end

    function Compiler:setReturn(scope, val)
        scope:addReferenceToHigherScope(self.containerFuncScope, self.returnVar);
        return Ast.AssignmentStatement({Ast.AssignmentVariable(self.containerFuncScope, self.returnVar)}, {val});
    end

    function Compiler:getReturn(scope)
        scope:addReferenceToHigherScope(self.containerFuncScope, self.returnVar);
        return Ast.VariableExpression(self.containerFuncScope, self.returnVar);
    end

    function Compiler:returnAssignment(scope)
        scope:addReferenceToHigherScope(self.containerFuncScope, self.returnVar);
        return Ast.AssignmentVariable(self.containerFuncScope, self.returnVar);
    end

    function Compiler:setUpvalueMember(scope, idExpr, valExpr, compoundConstructor)
        scope:addReferenceToHigherScope(self.scope, self.upvaluesTable);
        if compoundConstructor then
            return compoundConstructor(Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesTable), idExpr), valExpr);
        end
        return Ast.AssignmentStatement({Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesTable), idExpr)}, {valExpr});
    end

    function Compiler:getUpvalueMember(scope, idExpr)
        scope:addReferenceToHigherScope(self.scope, self.upvaluesTable);
        return Ast.IndexExpression(Ast.VariableExpression(self.scope, self.upvaluesTable), idExpr);
    end
end

`,"prometheus.compiler.statements.assignment":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- assignment.lua
--
-- This Script contains the statement handler for the AssignmentStatement.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local exprregs = {};
    local assignmentIndexingRegs = {};
    for i, primaryExpr in ipairs(statement.lhs) do
        if(primaryExpr.kind == AstKind.AssignmentIndexing) then
            assignmentIndexingRegs [i] = {
                base = self:compileExpression(primaryExpr.base, funcDepth, 1)[1],
                index = self:compileExpression(primaryExpr.index, funcDepth, 1)[1],
            };
        end
    end

    for i, expr in ipairs(statement.rhs) do
        if(i == #statement.rhs and #statement.lhs > #statement.rhs) then
            local regs = self:compileExpression(expr, funcDepth, #statement.lhs - #statement.rhs + 1);

            for i, reg in ipairs(regs) do
                if(self:isVarRegister(reg)) then
                    local ro = reg;
                    reg = self:allocRegister(false);
                    self:addStatement(self:copyRegisters(scope, {reg}, {ro}), {reg}, {ro}, false);
                end
                table.insert(exprregs, reg);
            end
        else
            if statement.lhs[i] or expr.kind == AstKind.FunctionCallExpression or expr.kind == AstKind.PassSelfFunctionCallExpression then
                local reg = self:compileExpression(expr, funcDepth, 1)[1];
                if(self:isVarRegister(reg)) then
                    local ro = reg;
                    reg = self:allocRegister(false);
                    self:addStatement(self:copyRegisters(scope, {reg}, {ro}), {reg}, {ro}, false);
                end
                table.insert(exprregs, reg);
            end
        end
    end

    for i, primaryExpr in ipairs(statement.lhs) do
        if primaryExpr.kind == AstKind.AssignmentVariable then
            if primaryExpr.scope.isGlobal then
                local tmpReg = self:allocRegister(false);
                self:addStatement(self:setRegister(scope, tmpReg, Ast.StringExpression(primaryExpr.scope:getVariableName(primaryExpr.id))), {tmpReg}, {}, false);
                self:addStatement(Ast.AssignmentStatement({Ast.AssignmentIndexing(self:env(scope), self:register(scope, tmpReg))},
                 {self:register(scope, exprregs[i])}), {}, {tmpReg, exprregs[i]}, true);
                self:freeRegister(tmpReg, false);
            else
                if self.scopeFunctionDepths[primaryExpr.scope] == funcDepth then
                    if self:isUpvalue(primaryExpr.scope, primaryExpr.id) then
                        local reg = self:getVarRegister(primaryExpr.scope, primaryExpr.id, funcDepth);
                        self:addStatement(self:setUpvalueMember(scope, self:register(scope, reg), self:register(scope, exprregs[i])), {}, {reg, exprregs[i]}, true);
                    else
                        local reg = self:getVarRegister(primaryExpr.scope, primaryExpr.id, funcDepth, exprregs[i]);
                        if reg ~= exprregs[i] then
                            self:addStatement(self:setRegister(scope, reg, self:register(scope, exprregs[i])), {reg}, {exprregs[i]}, false);
                        end
                    end
                else
                    local upvalId = self:getUpvalueId(primaryExpr.scope, primaryExpr.id);
                    scope:addReferenceToHigherScope(self.containerFuncScope, self.currentUpvaluesVar);
                    self:addStatement(self:setUpvalueMember(scope, Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.currentUpvaluesVar), Ast.NumberExpression(upvalId)), self:register(scope, exprregs[i])), {}, {exprregs[i]}, true);
                end
            end
        elseif primaryExpr.kind == AstKind.AssignmentIndexing then
            local baseReg = assignmentIndexingRegs[i].base;
            local indexReg = assignmentIndexingRegs[i].index;
            self:addStatement(Ast.AssignmentStatement({
                Ast.AssignmentIndexing(self:register(scope, baseReg), self:register(scope, indexReg))
            }, {
                self:register(scope, exprregs[i])
            }), {}, {exprregs[i], baseReg, indexReg}, true);
            self:freeRegister(exprregs[i], false);
            self:freeRegister(baseReg, false);
            self:freeRegister(indexReg, false);
        else
            error(string.format("Invalid Assignment lhs: %s", statement.lhs));
        end
    end
end;
`,"prometheus.compiler.statements.break_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- break_statement.lua
--
-- This Script contains the statement handler for the BreakStatement.

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local toFreeVars = {};
    local statScope;
    repeat
        statScope = statScope and statScope.parentScope or statement.scope;
        for id, name in ipairs(statScope.variables) do
            table.insert(toFreeVars, {
                scope = statScope,
                id = id;
            });
        end
    until statScope == statement.loop.body.scope;

    for i, var in pairs(toFreeVars) do
        local varScope, id = var.scope, var.id;
        local varReg = self:getVarRegister(varScope, id, nil, nil);
        if self:isUpvalue(varScope, id) then
            scope:addReferenceToHigherScope(self.scope, self.freeUpvalueFunc);
            self:addStatement(self:setRegister(scope, varReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.freeUpvalueFunc), {
                self:register(scope, varReg)
            })), {varReg}, {varReg}, false);
        else
            self:addStatement(self:setRegister(scope, varReg, Ast.NilExpression()), {varReg}, {}, false);
        end
    end


    self:addStatement(self:setPos(scope, statement.loop.__final_block.id), {self.POS_REGISTER}, {}, false);
    self.activeBlock.advanceToNextBlock = false;
end;
`,"prometheus.compiler.statements.compound":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- compound.lua
--
-- This Script contains the statement handler for the Compound statements (compound add, sub, mul, etc.)

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

local compoundConstructors = {
    [AstKind.CompoundAddStatement] = Ast.CompoundAddStatement,
    [AstKind.CompoundSubStatement] = Ast.CompoundSubStatement,
    [AstKind.CompoundMulStatement] = Ast.CompoundMulStatement,
    [AstKind.CompoundDivStatement] = Ast.CompoundDivStatement,
    [AstKind.CompoundModStatement] = Ast.CompoundModStatement,
    [AstKind.CompoundPowStatement] = Ast.CompoundPowStatement,
    [AstKind.CompoundConcatStatement] = Ast.CompoundConcatStatement,
};

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local compoundConstructor = compoundConstructors[statement.kind];
    if statement.lhs.kind == AstKind.AssignmentIndexing then
        local indexing = statement.lhs;
        local baseReg = self:compileExpression(indexing.base, funcDepth, 1)[1];
        local indexReg = self:compileExpression(indexing.index, funcDepth, 1)[1];
        local valueReg = self:compileExpression(statement.rhs, funcDepth, 1)[1];

        self:addStatement(compoundConstructor(Ast.AssignmentIndexing(self:register(scope, baseReg), self:register(scope, indexReg)), self:register(scope, valueReg)), {}, {baseReg, indexReg, valueReg}, true);
        self:freeRegister(baseReg, false);
        self:freeRegister(indexReg, false);
        self:freeRegister(valueReg, false);
    else
        local valueReg = self:compileExpression(statement.rhs, funcDepth, 1)[1];
        local primaryExpr = statement.lhs;
        if primaryExpr.scope.isGlobal then
            local tmpReg = self:allocRegister(false);
            self:addStatement(self:setRegister(scope, tmpReg, Ast.StringExpression(primaryExpr.scope:getVariableName(primaryExpr.id))), {tmpReg}, {}, false);
            self:addStatement(compoundConstructor(Ast.AssignmentIndexing(self:env(scope), self:register(scope, tmpReg)),
             self:register(scope, valueReg)), {}, {tmpReg, valueReg}, true);
            self:freeRegister(tmpReg, false);
            self:freeRegister(valueReg, false);
        else
            if self.scopeFunctionDepths[primaryExpr.scope] == funcDepth then
                if self:isUpvalue(primaryExpr.scope, primaryExpr.id) then
                    local reg = self:getVarRegister(primaryExpr.scope, primaryExpr.id, funcDepth);
                    self:addStatement(self:setUpvalueMember(scope, self:register(scope, reg), self:register(scope, valueReg), compoundConstructor), {}, {reg, valueReg}, true);
                else
                    local reg = self:getVarRegister(primaryExpr.scope, primaryExpr.id, funcDepth, valueReg);
                    if reg ~= valueReg then
                        self:addStatement(self:setRegister(scope, reg, self:register(scope, valueReg), compoundConstructor), {reg}, {valueReg}, false);
                    end
                end
            else
                local upvalId = self:getUpvalueId(primaryExpr.scope, primaryExpr.id);
                scope:addReferenceToHigherScope(self.containerFuncScope, self.currentUpvaluesVar);
                self:addStatement(self:setUpvalueMember(scope, Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.currentUpvaluesVar), Ast.NumberExpression(upvalId)), self:register(scope, valueReg), compoundConstructor), {}, {valueReg}, true);
            end
            self:freeRegister(valueReg, false);
        end
    end
end;
`,"prometheus.compiler.statements.continue_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- continue_statement.lua
--
-- This Script contains the statement handler for the ContinueStatement.

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local toFreeVars = {};
    local statScope;
    repeat
        statScope = statScope and statScope.parentScope or statement.scope;
        for id, _ in pairs(statScope.variables) do
            table.insert(toFreeVars, {
                scope = statScope,
                id = id;
            });
        end
    until statScope == statement.loop.body.scope;

    for _, var in ipairs(toFreeVars) do
        local varScope, id = var.scope, var.id;
        local varReg = self:getVarRegister(varScope, id, nil, nil);
        if self:isUpvalue(varScope, id) then
            scope:addReferenceToHigherScope(self.scope, self.freeUpvalueFunc);
            self:addStatement(self:setRegister(scope, varReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.freeUpvalueFunc), {
                self:register(scope, varReg)
            })), {varReg}, {varReg}, false);
        else
            self:addStatement(self:setRegister(scope, varReg, Ast.NilExpression()), {varReg}, {}, false);
        end
    end


    self:addStatement(self:setPos(scope, statement.loop.__start_block.id), {self.POS_REGISTER}, {}, false);
    self.activeBlock.advanceToNextBlock = false;
end;
`,"prometheus.compiler.statements.do_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- do_statement.lua
--
-- This Script contains the statement handler for the DoStatement.

return function(self, statement, funcDepth)
    self:compileBlock(statement.body, funcDepth);
end;

`,"prometheus.compiler.statements.for_in_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- for_in_statement.lua
--
-- This Script contains the statement handler for the ForInStatement

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local expressionsLength = #statement.expressions;
    local exprregs = {};
    for i, expr in ipairs(statement.expressions) do
        if(i == expressionsLength and expressionsLength < 3) then
            local regs = self:compileExpression(expr, funcDepth, 4 - expressionsLength);
            for i = 1, 4 - expressionsLength do
                table.insert(exprregs, regs[i]);
            end
        else
            if i <= 3 then
                table.insert(exprregs, self:compileExpression(expr, funcDepth, 1)[1])
            else
                self:freeRegister(self:compileExpression(expr, funcDepth, 1)[1], false);
            end
        end
    end

    for i, reg in ipairs(exprregs) do
        if reg and self.registers[reg] ~= self.VAR_REGISTER and reg ~= self.POS_REGISTER and reg ~= self.RETURN_REGISTER then
            self.registers[reg] = self.VAR_REGISTER;
        else
            exprregs[i] = self:allocRegister(true);
            self:addStatement(self:copyRegisters(scope, {exprregs[i]}, {reg}), {exprregs[i]}, {reg}, false);
        end
    end

    local checkBlock = self:createBlock();
    local bodyBlock = self:createBlock();
    local finalBlock = self:createBlock();

    statement.__start_block = checkBlock;
    statement.__final_block = finalBlock;

    self:addStatement(self:setPos(scope, checkBlock.id), {self.POS_REGISTER}, {}, false);

    self:setActiveBlock(checkBlock);
    local scope = self.activeBlock.scope;

    local varRegs = {};
    for i, id in ipairs(statement.ids) do
        varRegs[i] = self:getVarRegister(statement.scope, id, funcDepth)
    end



    self:addStatement(Ast.AssignmentStatement({
        self:registerAssignment(scope, exprregs[3]),
        varRegs[2] and self:registerAssignment(scope, varRegs[2]),
    }, {
        Ast.FunctionCallExpression(self:register(scope, exprregs[1]), {
            self:register(scope, exprregs[2]),
            self:register(scope, exprregs[3]),
        })
    }), {exprregs[3], varRegs[2]}, {exprregs[1], exprregs[2], exprregs[3]}, true);



    self:addStatement(Ast.AssignmentStatement({
        self:posAssignment(scope)
    }, {
        Ast.OrExpression(Ast.AndExpression(self:register(scope, exprregs[3]), Ast.NumberExpression(bodyBlock.id)), Ast.NumberExpression(finalBlock.id))
    }), {self.POS_REGISTER}, {exprregs[3]}, false);

    self:setActiveBlock(bodyBlock);
    local scope = self.activeBlock.scope;

    self:addStatement(self:copyRegisters(scope, {varRegs[1]}, {exprregs[3]}), {varRegs[1]}, {exprregs[3]}, false);

    for i=3, #varRegs do
        self:addStatement(self:setRegister(scope, varRegs[i], Ast.NilExpression()), {varRegs[i]}, {}, false);
    end

    for i, id in ipairs(statement.ids) do
        if(self:isUpvalue(statement.scope, id)) then
            local varreg = varRegs[i];
            local tmpReg = self:allocRegister(false);
            scope:addReferenceToHigherScope(self.scope, self.allocUpvalFunction);
            self:addStatement(self:setRegister(scope, tmpReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.allocUpvalFunction), {})), {tmpReg}, {}, false);
            self:addStatement(self:setUpvalueMember(scope, self:register(scope, tmpReg), self:register(scope, varreg)), {}, {tmpReg, varreg}, true);
            self:addStatement(self:copyRegisters(scope, {varreg}, {tmpReg}), {varreg}, {tmpReg}, false);
            self:freeRegister(tmpReg, false);
        end
    end

    self:compileBlock(statement.body, funcDepth);
    self:addStatement(self:setPos(scope, checkBlock.id), {self.POS_REGISTER}, {}, false);
    self:setActiveBlock(finalBlock);

    for i, _ in ipairs(exprregs) do
        self:freeRegister(exprregs[i], true)
    end
end;
`,"prometheus.compiler.statements.for_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- for_statement.lua
--
-- This Script contains the statement handler for the ForStatement

local Ast = require("prometheus.ast");
local util = require("prometheus.util");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local checkBlock = self:createBlock();
    local innerBlock = self:createBlock();
    local finalBlock = self:createBlock();

    statement.__start_block = checkBlock;
    statement.__final_block = finalBlock;

    local posState = self.registers[self.POS_REGISTER];
    self.registers[self.POS_REGISTER] = self.VAR_REGISTER;

    local initialReg = self:compileExpression(statement.initialValue, funcDepth, 1)[1];

    local finalExprReg = self:compileExpression(statement.finalValue, funcDepth, 1)[1];
    local finalReg = self:allocRegister(false);
    self:addStatement(self:copyRegisters(scope, {finalReg}, {finalExprReg}), {finalReg}, {finalExprReg}, false);
    self:freeRegister(finalExprReg);

    local incrementExprReg = self:compileExpression(statement.incrementBy, funcDepth, 1)[1];
    local incrementReg = self:allocRegister(false);
    self:addStatement(self:copyRegisters(scope, {incrementReg}, {incrementExprReg}), {incrementReg}, {incrementExprReg}, false);
    self:freeRegister(incrementExprReg);

    local tmpReg = self:allocRegister(false);
    self:addStatement(self:setRegister(scope, tmpReg, Ast.NumberExpression(0)), {tmpReg}, {}, false);
    local incrementIsNegReg = self:allocRegister(false);

    local shouldSwap3 = math.random(1, 2) == 2;
    local shuffledRegs4 = shouldSwap3 and {incrementReg, tmpReg} or {tmpReg, incrementReg};
    self:addStatement(self:setRegister(scope, incrementIsNegReg, Ast[shouldSwap3 and "LessThanExpression" or "GreaterThanExpression"](self:register(scope, shuffledRegs4[1]), self:register(scope, shuffledRegs4[2]))), {incrementIsNegReg}, {shuffledRegs4[1], shuffledRegs4[2]}, false);

    self:freeRegister(tmpReg);

    local currentReg = self:allocRegister(true);
    self:addStatement(self:setRegister(scope, currentReg, Ast.SubExpression(self:register(scope, initialReg), self:register(scope, incrementReg))), {currentReg}, {initialReg, incrementReg}, false);
    self:freeRegister(initialReg);

    self:addStatement(self:jmp(scope, Ast.NumberExpression(checkBlock.id)), {self.POS_REGISTER}, {}, false);

    self:setActiveBlock(checkBlock);

    scope = checkBlock.scope;

    -- x = x + y or x = y + x instead of just x = x + y.
    --> NEW: In an attempt to thwart deobfuscations, despite this being a simple comparison... Shuffling these causes problems for decompilers.
    --> NOTE: This isn't unstable code, I've tested it multiple times.

    local shuffledRegs = util.shuffle({currentReg, incrementReg});
    self:addStatement(self:setRegister(scope, currentReg, Ast.AddExpression(self:register(scope, shuffledRegs[1]), self:register(scope, shuffledRegs[2]))), {currentReg}, {shuffledRegs[1], shuffledRegs[2]}, false);
    local tmpReg1 = self:allocRegister(false);
    local tmpReg2 = self:allocRegister(false);
    self:addStatement(self:setRegister(scope, tmpReg2, Ast.NotExpression(self:register(scope, incrementIsNegReg))), {tmpReg2}, {incrementIsNegReg}, false);

    local shouldSwap = math.random(1, 2) == 2;
    local shuffledRegs2 = shouldSwap and {currentReg, finalReg} or {finalReg, currentReg};
    self:addStatement(self:setRegister(scope, tmpReg1, Ast[shouldSwap and "LessThanOrEqualsExpression" or "GreaterThanOrEqualsExpression"](self:register(scope, shuffledRegs2[1]), self:register(scope, shuffledRegs2[2]))), {tmpReg1}, {shuffledRegs2[1], shuffledRegs2[2]}, false);
    self:addStatement(self:setRegister(scope, tmpReg1, Ast.AndExpression(self:register(scope, tmpReg2), self:register(scope, tmpReg1))), {tmpReg1}, {tmpReg1, tmpReg2}, false);

    local shouldSwap2 = math.random(1, 2) == 2;
    local shuffledRegs3 = shouldSwap2 and {currentReg, finalReg} or {finalReg, currentReg};
    self:addStatement(self:setRegister(scope, tmpReg2, Ast[shouldSwap2 and "GreaterThanOrEqualsExpression" or "LessThanOrEqualsExpression"](self:register(scope, shuffledRegs3[1]), self:register(scope, shuffledRegs3[2]))), {tmpReg2}, {shuffledRegs3[1], shuffledRegs3[2]}, false);

    self:addStatement(self:setRegister(scope, tmpReg2, Ast.AndExpression(self:register(scope, incrementIsNegReg), self:register(scope, tmpReg2))), {tmpReg2}, {tmpReg2, incrementIsNegReg}, false);
    self:addStatement(self:setRegister(scope, tmpReg1, Ast.OrExpression(self:register(scope, tmpReg2), self:register(scope, tmpReg1))), {tmpReg1}, {tmpReg1, tmpReg2}, false);
    self:freeRegister(tmpReg2);
    tmpReg2 = self:compileExpression(Ast.NumberExpression(innerBlock.id), funcDepth, 1)[1];
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.AndExpression(self:register(scope, tmpReg1), self:register(scope, tmpReg2))), {self.POS_REGISTER}, {tmpReg1, tmpReg2}, false);
    self:freeRegister(tmpReg2);
    self:freeRegister(tmpReg1);
    tmpReg2 = self:compileExpression(Ast.NumberExpression(finalBlock.id), funcDepth, 1)[1];
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(self:register(scope, self.POS_REGISTER), self:register(scope, tmpReg2))), {self.POS_REGISTER}, {self.POS_REGISTER, tmpReg2}, false);
    self:freeRegister(tmpReg2);

    self:setActiveBlock(innerBlock);
    scope = innerBlock.scope;
    self.registers[self.POS_REGISTER] = posState;

    local varReg = self:getVarRegister(statement.scope, statement.id, funcDepth, nil);

    if(self:isUpvalue(statement.scope, statement.id)) then
        scope:addReferenceToHigherScope(self.scope, self.allocUpvalFunction);
        self:addStatement(self:setRegister(scope, varReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.allocUpvalFunction), {})), {varReg}, {}, false);
        self:addStatement(self:setUpvalueMember(scope, self:register(scope, varReg), self:register(scope, currentReg)), {}, {varReg, currentReg}, true);
    else
        self:addStatement(self:setRegister(scope, varReg, self:register(scope, currentReg)), {varReg}, {currentReg}, false);
    end


    self:compileBlock(statement.body, funcDepth);
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(checkBlock.id)), {self.POS_REGISTER}, {}, false);

    self.registers[self.POS_REGISTER] = self.VAR_REGISTER;
    self:freeRegister(finalReg);
    self:freeRegister(incrementIsNegReg);
    self:freeRegister(incrementReg);
    self:freeRegister(currentReg, true);

    self.registers[self.POS_REGISTER] = posState;
    self:setActiveBlock(finalBlock);
end;

`,"prometheus.compiler.statements.function_call":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- function_call.lua
--
-- This Script contains the statement handler for the FunctionCallStatement.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local baseReg = self:compileExpression(statement.base, funcDepth, 1)[1];
    local retReg = self:allocRegister(false);
    local regs = {};
    local args = {};

    for i, expr in ipairs(statement.args) do
        if i == #statement.args and (expr.kind == AstKind.FunctionCallExpression or expr.kind == AstKind.PassSelfFunctionCallExpression or expr.kind == AstKind.VarargExpression) then
            local reg = self:compileExpression(expr, funcDepth, self.RETURN_ALL)[1];
            table.insert(args, Ast.FunctionCallExpression(
                self:unpack(scope),
                {self:register(scope, reg)}));
            table.insert(regs, reg);
        else
            local reg = self:compileExpression(expr, funcDepth, 1)[1];
            local argExpr = self:register(scope, reg);
            table.insert(args, argExpr);
            table.insert(regs, reg);
        end
    end

    self:addStatement(self:setRegister(scope, retReg, Ast.FunctionCallExpression(self:register(scope, baseReg), args)), {retReg}, {baseReg, unpack(regs)}, true);
    self:freeRegister(baseReg, false);
    self:freeRegister(retReg, false);
    for _, reg in ipairs(regs) do
        self:freeRegister(reg, false);
    end
end;

`,"prometheus.compiler.statements.function_declaration":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- function_declaration.lua
--
-- This Script contains the statement handler for the FunctionDeclaration.

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local retReg = self:compileFunction(statement, funcDepth);
    if(#statement.indices > 0) then
        local tblReg;
        if statement.scope.isGlobal then
            tblReg = self:allocRegister(false);
            self:addStatement(self:setRegister(scope, tblReg, Ast.StringExpression(statement.scope:getVariableName(statement.id))), {tblReg}, {}, false);
            self:addStatement(self:setRegister(scope, tblReg, Ast.IndexExpression(self:env(scope), self:register(scope, tblReg))), {tblReg}, {tblReg}, true);
        else
            if self.scopeFunctionDepths[statement.scope] == funcDepth then
                if self:isUpvalue(statement.scope, statement.id) then
                    tblReg = self:allocRegister(false);
                    local reg = self:getVarRegister(statement.scope, statement.id, funcDepth);
                    self:addStatement(self:setRegister(scope, tblReg, self:getUpvalueMember(scope, self:register(scope, reg))), {tblReg}, {reg}, true);
                else
                    tblReg = self:getVarRegister(statement.scope, statement.id, funcDepth, retReg);
                end
            else
                tblReg = self:allocRegister(false);
                local upvalId = self:getUpvalueId(statement.scope, statement.id);
                scope:addReferenceToHigherScope(self.containerFuncScope, self.currentUpvaluesVar);
                self:addStatement(self:setRegister(scope, tblReg, self:getUpvalueMember(scope, Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.currentUpvaluesVar), Ast.NumberExpression(upvalId)))), {tblReg}, {}, true);
            end
        end

        for i = 1, #statement.indices - 1 do
            local index = statement.indices[i];
            local indexReg = self:compileExpression(Ast.StringExpression(index), funcDepth, 1)[1];
            local tblRegOld = tblReg;
            tblReg = self:allocRegister(false);
            self:addStatement(self:setRegister(scope, tblReg, Ast.IndexExpression(self:register(scope, tblRegOld), self:register(scope, indexReg))), {tblReg}, {tblReg, indexReg}, false);
            self:freeRegister(tblRegOld, false);
            self:freeRegister(indexReg, false);
        end

        local index = statement.indices[#statement.indices];
        local indexReg = self:compileExpression(Ast.StringExpression(index), funcDepth, 1)[1];
        self:addStatement(Ast.AssignmentStatement({
            Ast.AssignmentIndexing(self:register(scope, tblReg), self:register(scope, indexReg)),
        }, {
            self:register(scope, retReg),
        }), {}, {tblReg, indexReg, retReg}, true);
        self:freeRegister(indexReg, false);
        self:freeRegister(tblReg, false);
        self:freeRegister(retReg, false);

        return;
    end
    if statement.scope.isGlobal then
        local tmpReg = self:allocRegister(false);
        self:addStatement(self:setRegister(scope, tmpReg, Ast.StringExpression(statement.scope:getVariableName(statement.id))), {tmpReg}, {}, false);
        self:addStatement(Ast.AssignmentStatement({Ast.AssignmentIndexing(self:env(scope), self:register(scope, tmpReg))},
         {self:register(scope, retReg)}), {}, {tmpReg, retReg}, true);
        self:freeRegister(tmpReg, false);
    else
        if self.scopeFunctionDepths[statement.scope] == funcDepth then
            if self:isUpvalue(statement.scope, statement.id) then
                local reg = self:getVarRegister(statement.scope, statement.id, funcDepth);
                self:addStatement(self:setUpvalueMember(scope, self:register(scope, reg), self:register(scope, retReg)), {}, {reg, retReg}, true);
            else
                local reg = self:getVarRegister(statement.scope, statement.id, funcDepth, retReg);
                if reg ~= retReg then
                    self:addStatement(self:setRegister(scope, reg, self:register(scope, retReg)), {reg}, {retReg}, false);
                end
            end
        else
            local upvalId = self:getUpvalueId(statement.scope, statement.id);
            scope:addReferenceToHigherScope(self.containerFuncScope, self.currentUpvaluesVar);
            self:addStatement(self:setUpvalueMember(scope, Ast.IndexExpression(Ast.VariableExpression(self.containerFuncScope, self.currentUpvaluesVar), Ast.NumberExpression(upvalId)), self:register(scope, retReg)), {}, {retReg}, true);
        end
    end
    self:freeRegister(retReg, false);
end;

`,"prometheus.compiler.statements.if_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- if_statement.lua
--
-- This Script contains the statement handler for the IfStatement.

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local conditionReg = self:compileExpression(statement.condition, funcDepth, 1)[1];
    local finalBlock = self:createBlock();

    local nextBlock
    if statement.elsebody or #statement.elseifs > 0 then
        nextBlock = self:createBlock();
    else
        nextBlock = finalBlock;
    end
    local innerBlock = self:createBlock();


    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(scope, conditionReg), Ast.NumberExpression(innerBlock.id)), Ast.NumberExpression(nextBlock.id))), {self.POS_REGISTER}, {conditionReg}, false);

    self:freeRegister(conditionReg, false);

    self:setActiveBlock(innerBlock);
    scope = innerBlock.scope
    self:compileBlock(statement.body, funcDepth);
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(finalBlock.id)), {self.POS_REGISTER}, {}, false);

    for i, eif in ipairs(statement.elseifs) do
        self:setActiveBlock(nextBlock);
        conditionReg = self:compileExpression(eif.condition, funcDepth, 1)[1];
        local innerBlock = self:createBlock();
        if statement.elsebody or i < #statement.elseifs then
            nextBlock = self:createBlock();
        else
            nextBlock = finalBlock;
        end
        local scope = self.activeBlock.scope;

        self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(scope, conditionReg), Ast.NumberExpression(innerBlock.id)), Ast.NumberExpression(nextBlock.id))), {self.POS_REGISTER}, {conditionReg}, false);


        self:freeRegister(conditionReg, false);

        self:setActiveBlock(innerBlock);
        scope = innerBlock.scope;
        self:compileBlock(eif.body, funcDepth);
        self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(finalBlock.id)), {self.POS_REGISTER}, {}, false);
    end

    if statement.elsebody then
        self:setActiveBlock(nextBlock);
        self:compileBlock(statement.elsebody, funcDepth);
        self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(finalBlock.id)), {self.POS_REGISTER}, {}, false);
    end

    self:setActiveBlock(finalBlock);
end;
`,"prometheus.compiler.statements.local_function_declaration":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- local_function_declaration.lua
--
-- This Script contains the statement handler for the LocalFunctionDeclaration

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;

    if(self:isUpvalue(statement.scope, statement.id)) then
        local varReg = self:getVarRegister(statement.scope, statement.id, funcDepth, nil);
        scope:addReferenceToHigherScope(self.scope, self.allocUpvalFunction);
        self:addStatement(self:setRegister(scope, varReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.allocUpvalFunction), {})), {varReg}, {}, false);
        local retReg = self:compileFunction(statement, funcDepth);
        self:addStatement(self:setUpvalueMember(scope, self:register(scope, varReg), self:register(scope, retReg)), {}, {varReg, retReg}, true);
        self:freeRegister(retReg, false);
    else
        local retReg = self:compileFunction(statement, funcDepth);
        local varReg = self:getVarRegister(statement.scope, statement.id, funcDepth, retReg);

        self:addStatement(self:copyRegisters(scope, {varReg}, {retReg}), {varReg}, {retReg}, false);
        self:freeRegister(retReg, false);
    end
end;

`,"prometheus.compiler.statements.local_variable_declaration":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- local_variable_declaration.lua
--
-- This Script contains the statement handler for the LocalVariableDeclaration

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local exprregs = {};
    for i, expr in ipairs(statement.expressions) do
        if(i == #statement.expressions and #statement.ids > #statement.expressions) then
            local regs = self:compileExpression(expr, funcDepth, #statement.ids - #statement.expressions + 1);
            for i, reg in ipairs(regs) do
                table.insert(exprregs, reg);
            end
        else
            if statement.ids[i] or expr.kind == AstKind.FunctionCallExpression or expr.kind == AstKind.PassSelfFunctionCallExpression then
                local reg = self:compileExpression(expr, funcDepth, 1)[1];
                table.insert(exprregs, reg);
            end
        end
    end

    if #exprregs == 0 then
        for _=1, #statement.ids do
            table.insert(exprregs, self:compileExpression(Ast.NilExpression(), funcDepth, 1)[1]);
        end
    end

    for i, id in ipairs(statement.ids) do
        if(exprregs[i]) then
            if(self:isUpvalue(statement.scope, id)) then
                local varreg = self:getVarRegister(statement.scope, id, funcDepth);
                local varReg = self:getVarRegister(statement.scope, id, funcDepth, nil);
                scope:addReferenceToHigherScope(self.scope, self.allocUpvalFunction);
                self:addStatement(self:setRegister(scope, varReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.allocUpvalFunction), {})), {varReg}, {}, false);
                self:addStatement(self:setUpvalueMember(scope, self:register(scope, varReg), self:register(scope, exprregs[i])), {}, {varReg, exprregs[i]}, true);
                self:freeRegister(exprregs[i], false);
            else
                local varreg = self:getVarRegister(statement.scope, id, funcDepth, exprregs[i]);
                self:addStatement(self:copyRegisters(scope, {varreg}, {exprregs[i]}), {varreg}, {exprregs[i]}, false);
                self:freeRegister(exprregs[i], false);
            end
        end
    end

    if not self.scopeFunctionDepths[statement.scope] then
        self.scopeFunctionDepths[statement.scope] = funcDepth;
    end
end;

`,"prometheus.compiler.statements.pass_self_function_call":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- pass_self_function_call.lua
--
-- This Script contains the statement handler for the PassSelfFunctionCallStatement.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local baseReg = self:compileExpression(statement.base, funcDepth, 1)[1];
    local tmpReg = self:allocRegister(false);
    local args = { self:register(scope, baseReg) };
    local regs = { baseReg };

    for i, expr in ipairs(statement.args) do
        if i == #statement.args and (expr.kind == AstKind.FunctionCallExpression or expr.kind == AstKind.PassSelfFunctionCallExpression or expr.kind == AstKind.VarargExpression) then
            local reg = self:compileExpression(expr, funcDepth, self.RETURN_ALL)[1];
            table.insert(args, Ast.FunctionCallExpression(
                self:unpack(scope),
                {self:register(scope, reg)}));
            table.insert(regs, reg);
        else
            local reg = self:compileExpression(expr, funcDepth, 1)[1];
            table.insert(args, self:register(scope, reg));
            table.insert(regs, reg);
        end
    end
    self:addStatement(self:setRegister(scope, tmpReg, Ast.StringExpression(statement.passSelfFunctionName)), {tmpReg}, {}, false);
    self:addStatement(self:setRegister(scope, tmpReg, Ast.IndexExpression(self:register(scope, baseReg), self:register(scope, tmpReg))), {tmpReg}, {tmpReg, baseReg}, false);

    self:addStatement(self:setRegister(scope, tmpReg, Ast.FunctionCallExpression(self:register(scope, tmpReg), args)), {tmpReg}, {tmpReg, unpack(regs)}, true);

    self:freeRegister(tmpReg, false);
    for _, reg in ipairs(regs) do
        self:freeRegister(reg, false);
    end
end;

`,"prometheus.compiler.statements.repeat_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- repeat_statement.lua
--
-- This Script contains the statement handler for the RepeatStatement.

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local innerBlock = self:createBlock();
    local finalBlock = self:createBlock();
    statement.__start_block = innerBlock;
    statement.__final_block = finalBlock;

    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.NumberExpression(innerBlock.id)), {self.POS_REGISTER}, {}, false);
    self:setActiveBlock(innerBlock);

    for _, stat in ipairs(statement.body.statements) do
        self:compileStatement(stat, funcDepth);
    end;

    local scope = self.activeBlock.scope;
    local conditionReg = (self:compileExpression(statement.condition, funcDepth, 1))[1];
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(scope, conditionReg), Ast.NumberExpression(finalBlock.id)), Ast.NumberExpression(innerBlock.id))), { self.POS_REGISTER }, { conditionReg }, false);
    self:freeRegister(conditionReg, false);

    for id, _ in ipairs(statement.body.scope.variables) do
        local varReg = self:getVarRegister(statement.body.scope, id, funcDepth, nil);
        if self:isUpvalue(statement.body.scope, id) then
            scope:addReferenceToHigherScope(self.scope, self.freeUpvalueFunc);
            self:addStatement(self:setRegister(scope, varReg, Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.freeUpvalueFunc), { self:register(scope, varReg) })), { varReg }, { varReg }, false);
        else
            self:addStatement(self:setRegister(scope, varReg, Ast.NilExpression()), { varReg }, {}, false);
        end;
        self:freeRegister(varReg, true);
    end;

    self:setActiveBlock(finalBlock);
end;
`,"prometheus.compiler.statements.return":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- return.lua
--
-- This Script contains the statement handler for the ReturnStatement.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local entries = {};
    local regs = {};

    for i, expr in ipairs(statement.args) do
        if i == #statement.args and (expr.kind == AstKind.FunctionCallExpression or expr.kind == AstKind.PassSelfFunctionCallExpression or expr.kind == AstKind.VarargExpression) then
            local reg = self:compileExpression(expr, funcDepth, self.RETURN_ALL)[1];
            table.insert(entries, Ast.TableEntry(Ast.FunctionCallExpression(
                self:unpack(scope),
                {self:register(scope, reg)})));
            table.insert(regs, reg);
        else
            local reg = self:compileExpression(expr, funcDepth, 1)[1];
            table.insert(entries, Ast.TableEntry(self:register(scope, reg)));
            table.insert(regs, reg);
        end
    end

    for _, reg in ipairs(regs) do
        self:freeRegister(reg, false);
    end

    self:addStatement(self:setReturn(scope, Ast.TableConstructorExpression(entries)), {self.RETURN_REGISTER}, regs, false);
    self:addStatement(self:setPos(self.activeBlock.scope, nil), {self.POS_REGISTER}, {}, false);
    self.activeBlock.advanceToNextBlock = false;
end;
`,"prometheus.compiler.statements.while_statement":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- while_statement.lua
--
-- This Script contains the statement handler for the WhileStatement

local Ast = require("prometheus.ast");

return function(self, statement, funcDepth)
    local scope = self.activeBlock.scope;
    local innerBlock = self:createBlock();
    local finalBlock = self:createBlock();
    local checkBlock = self:createBlock();

    statement.__start_block = checkBlock;
    statement.__final_block = finalBlock;

    self:addStatement(self:setPos(scope, checkBlock.id), {self.POS_REGISTER}, {}, false);

    self:setActiveBlock(checkBlock);
    scope = self.activeBlock.scope;
    local conditionReg = self:compileExpression(statement.condition, funcDepth, 1)[1];
    self:addStatement(self:setRegister(scope, self.POS_REGISTER, Ast.OrExpression(Ast.AndExpression(self:register(scope, conditionReg), Ast.NumberExpression(innerBlock.id)), Ast.NumberExpression(finalBlock.id))), {self.POS_REGISTER}, {conditionReg}, false);
    self:freeRegister(conditionReg, false);

    self:setActiveBlock(innerBlock);
    local scope = self.activeBlock.scope;
    self:compileBlock(statement.body, funcDepth);
    self:addStatement(self:setPos(scope, checkBlock.id), {self.POS_REGISTER}, {}, false);
    self:setActiveBlock(finalBlock);
end;
`,"prometheus.compiler.statements":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- statements.lua
--
-- This Script contains the statement handlers: exports handler table keyed by AstKind.

local Ast = require("prometheus.ast");
local AstKind = Ast.AstKind;

local handlers = {};
local statements = "prometheus.compiler.statements.";
local function requireStatement(name)
    return require(statements .. name);
end

handlers[AstKind.ReturnStatement] = requireStatement("return");
handlers[AstKind.LocalVariableDeclaration] = requireStatement("local_variable_declaration");
handlers[AstKind.FunctionCallStatement] = requireStatement("function_call");
handlers[AstKind.PassSelfFunctionCallStatement] = requireStatement("pass_self_function_call");
handlers[AstKind.LocalFunctionDeclaration] = requireStatement("local_function_declaration");
handlers[AstKind.FunctionDeclaration] = requireStatement("function_declaration");
handlers[AstKind.AssignmentStatement] = requireStatement("assignment");
handlers[AstKind.IfStatement] = requireStatement("if_statement");
handlers[AstKind.DoStatement] = requireStatement("do_statement");
handlers[AstKind.WhileStatement] = requireStatement("while_statement");
handlers[AstKind.RepeatStatement] = requireStatement("repeat_statement");
handlers[AstKind.ForStatement] = requireStatement("for_statement");
handlers[AstKind.ForInStatement] = requireStatement("for_in_statement");
handlers[AstKind.BreakStatement] = requireStatement("break_statement");
handlers[AstKind.ContinueStatement] = requireStatement("continue_statement");

-- Compound statements share one handler
local compoundHandler = requireStatement("compound");
handlers[AstKind.CompoundAddStatement] = compoundHandler;
handlers[AstKind.CompoundSubStatement] = compoundHandler;
handlers[AstKind.CompoundMulStatement] = compoundHandler;
handlers[AstKind.CompoundDivStatement] = compoundHandler;
handlers[AstKind.CompoundModStatement] = compoundHandler;
handlers[AstKind.CompoundPowStatement] = compoundHandler;
handlers[AstKind.CompoundConcatStatement] = compoundHandler;

return handlers;

`,"prometheus.compiler.upvalue":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- upvalue.lua
--
-- This Script contains the upvalue and GC management for the compiler.

local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");
local util = require("prometheus.util");

local unpack = unpack or table.unpack;

return function(Compiler)
    function Compiler:createUpvaluesGcFunc()
        local scope = Scope:new(self.scope);
        local selfVar = scope:addVariable();

        local iteratorVar = scope:addVariable();
        local valueVar = scope:addVariable();

        local whileScope = Scope:new(scope);
        whileScope:addReferenceToHigherScope(self.scope, self.upvaluesReferenceCountsTable, 3);
        whileScope:addReferenceToHigherScope(scope, valueVar, 3);
        whileScope:addReferenceToHigherScope(scope, iteratorVar, 3);

        local ifScope = Scope:new(whileScope);
        ifScope:addReferenceToHigherScope(self.scope, self.upvaluesReferenceCountsTable, 1);
        ifScope:addReferenceToHigherScope(self.scope, self.upvaluesTable, 1);

        return Ast.FunctionLiteralExpression({Ast.VariableExpression(scope, selfVar)}, Ast.Block({
            Ast.LocalVariableDeclaration(scope, {iteratorVar, valueVar}, {Ast.NumberExpression(1), Ast.IndexExpression(Ast.VariableExpression(scope, selfVar), Ast.NumberExpression(1))}),
            Ast.WhileStatement(Ast.Block({
                Ast.AssignmentStatement({
                    Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, valueVar)),
                    Ast.AssignmentVariable(scope, iteratorVar),
                }, {
                    Ast.SubExpression(Ast.IndexExpression(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, valueVar)), Ast.NumberExpression(1)),
                    Ast.AddExpression(unpack(util.shuffle{Ast.VariableExpression(scope, iteratorVar), Ast.NumberExpression(1)})),
                }),
                Ast.IfStatement(Ast.EqualsExpression(unpack(util.shuffle{Ast.IndexExpression(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, valueVar)), Ast.NumberExpression(0)})), Ast.Block({
                    Ast.AssignmentStatement({
                        Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, valueVar)),
                        Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesTable), Ast.VariableExpression(scope, valueVar)),
                    }, {
                        Ast.NilExpression(),
                        Ast.NilExpression(),
                    })
                }, ifScope), {}, nil),
                Ast.AssignmentStatement({
                    Ast.AssignmentVariable(scope, valueVar),
                }, {
                    Ast.IndexExpression(Ast.VariableExpression(scope, selfVar), Ast.VariableExpression(scope, iteratorVar)),
                }),
            }, whileScope), Ast.VariableExpression(scope, valueVar), scope);
        }, scope));
    end

    function Compiler:createFreeUpvalueFunc()
        local scope = Scope:new(self.scope);
        local argVar = scope:addVariable();
        local ifScope = Scope:new(scope);
        ifScope:addReferenceToHigherScope(scope, argVar, 3);
        scope:addReferenceToHigherScope(self.scope, self.upvaluesReferenceCountsTable, 2);
        return Ast.FunctionLiteralExpression({Ast.VariableExpression(scope, argVar)}, Ast.Block({
            Ast.AssignmentStatement({
                Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, argVar))
            }, {
                Ast.SubExpression(Ast.IndexExpression(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, argVar)), Ast.NumberExpression(1));
            }),
            Ast.IfStatement(Ast.EqualsExpression(unpack(util.shuffle{Ast.IndexExpression(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, argVar)), Ast.NumberExpression(0)})), Ast.Block({
                Ast.AssignmentStatement({
                    Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(scope, argVar)),
                    Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesTable), Ast.VariableExpression(scope, argVar)),
                }, {
                    Ast.NilExpression(),
                    Ast.NilExpression(),
                })
            }, ifScope), {}, nil)
        }, scope))
    end

    function Compiler:createUpvaluesProxyFunc()
        local scope = Scope:new(self.scope);
        scope:addReferenceToHigherScope(self.scope, self.newproxyVar);

        local entriesVar = scope:addVariable();

        local ifScope = Scope:new(scope);
        local proxyVar = ifScope:addVariable();
        local metatableVar = ifScope:addVariable();
        local elseScope = Scope:new(scope);
        ifScope:addReferenceToHigherScope(self.scope, self.newproxyVar);
        ifScope:addReferenceToHigherScope(self.scope, self.getmetatableVar);
        ifScope:addReferenceToHigherScope(self.scope, self.upvaluesGcFunctionVar);
        ifScope:addReferenceToHigherScope(scope, entriesVar);
        elseScope:addReferenceToHigherScope(self.scope, self.setmetatableVar);
        elseScope:addReferenceToHigherScope(scope, entriesVar);
        elseScope:addReferenceToHigherScope(self.scope, self.upvaluesGcFunctionVar);

        local forScope = Scope:new(scope);
        local forArg = forScope:addVariable();
        forScope:addReferenceToHigherScope(self.scope, self.upvaluesReferenceCountsTable, 2);
        forScope:addReferenceToHigherScope(scope, entriesVar, 2);

        return Ast.FunctionLiteralExpression({Ast.VariableExpression(scope, entriesVar)}, Ast.Block({
            Ast.ForStatement(forScope, forArg, Ast.NumberExpression(1), Ast.LenExpression(Ast.VariableExpression(scope, entriesVar)), Ast.NumberExpression(1), Ast.Block({
                Ast.AssignmentStatement({
                    Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.IndexExpression(Ast.VariableExpression(scope, entriesVar), Ast.VariableExpression(forScope, forArg)))
                }, {
                    Ast.AddExpression(unpack(util.shuffle{
                        Ast.IndexExpression(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.IndexExpression(Ast.VariableExpression(scope, entriesVar), Ast.VariableExpression(forScope, forArg))),
                        Ast.NumberExpression(1),
                    }))
                })
            }, forScope), scope);
            Ast.IfStatement(Ast.VariableExpression(self.scope, self.newproxyVar), Ast.Block({
                Ast.LocalVariableDeclaration(ifScope, {proxyVar}, {
                    Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.newproxyVar), {
                        Ast.BooleanExpression(true)
                    });
                });
                Ast.LocalVariableDeclaration(ifScope, {metatableVar}, {
                    Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.getmetatableVar), {
                        Ast.VariableExpression(ifScope, proxyVar);
                    });
                });
                Ast.AssignmentStatement({
                    Ast.AssignmentIndexing(Ast.VariableExpression(ifScope, metatableVar), Ast.StringExpression("__index")),
                    Ast.AssignmentIndexing(Ast.VariableExpression(ifScope, metatableVar), Ast.StringExpression("__gc")),
                    Ast.AssignmentIndexing(Ast.VariableExpression(ifScope, metatableVar), Ast.StringExpression("__len")),
                }, {
                    Ast.VariableExpression(scope, entriesVar),
                    Ast.VariableExpression(self.scope, self.upvaluesGcFunctionVar),
                    Ast.FunctionLiteralExpression({}, Ast.Block({
                        Ast.ReturnStatement({Ast.NumberExpression(self.upvalsProxyLenReturn)})
                    }, Scope:new(ifScope)));
                });
                Ast.ReturnStatement({
                    Ast.VariableExpression(ifScope, proxyVar)
                })
            }, ifScope), {}, Ast.Block({
                Ast.ReturnStatement({Ast.FunctionCallExpression(Ast.VariableExpression(self.scope, self.setmetatableVar), {
                    Ast.TableConstructorExpression({}),
                    Ast.TableConstructorExpression({
                        Ast.KeyedTableEntry(Ast.StringExpression("__gc"), Ast.VariableExpression(self.scope, self.upvaluesGcFunctionVar)),
                        Ast.KeyedTableEntry(Ast.StringExpression("__index"), Ast.VariableExpression(scope, entriesVar)),
                        Ast.KeyedTableEntry(Ast.StringExpression("__len"), Ast.FunctionLiteralExpression({}, Ast.Block({
                            Ast.ReturnStatement({Ast.NumberExpression(self.upvalsProxyLenReturn)})
                        }, Scope:new(ifScope)))),
                    })
                })})
            }, elseScope));
        }, scope));
    end

    function Compiler:createAllocUpvalFunction()
        local scope = Scope:new(self.scope);
        scope:addReferenceToHigherScope(self.scope, self.currentUpvalId, 4);
        scope:addReferenceToHigherScope(self.scope, self.upvaluesReferenceCountsTable, 1);

        return Ast.FunctionLiteralExpression({}, Ast.Block({
            Ast.AssignmentStatement({
                    Ast.AssignmentVariable(self.scope, self.currentUpvalId),
                },{
                    Ast.AddExpression(unpack(util.shuffle({
                        Ast.VariableExpression(self.scope, self.currentUpvalId),
                        Ast.NumberExpression(1),
                    }))),
                }
            ),
            Ast.AssignmentStatement({
                Ast.AssignmentIndexing(Ast.VariableExpression(self.scope, self.upvaluesReferenceCountsTable), Ast.VariableExpression(self.scope, self.currentUpvalId)),
            }, {
                Ast.NumberExpression(1),
            }),
            Ast.ReturnStatement({
                Ast.VariableExpression(self.scope, self.currentUpvalId),
            })
        }, scope));
    end
end

`,"prometheus.enums":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- enums.lua
--
-- This Script provides some enums used by the Obfuscator.

local Enums = {};

local chararray = require("prometheus.util").chararray;

Enums.LuaVersion = {
	LuaU = "LuaU" ,
	Lua51 = "Lua51",
}

Enums.Conventions = {
	[Enums.LuaVersion.Lua51] = {
		Keywords = {
			"and", "break", "do", "else", "elseif",
			"end", "false", "for", "function", "if",
			"in", "local", "nil", "not", "or",
			"repeat", "return", "then", "true", "until", "while"
		},

		SymbolChars = chararray("+-*/%^#=~<>(){}[];:,."),
		MaxSymbolLength = 3,
		Symbols = {
			"+", "-", "*", "/", "%", "^", "#",
			"==", "~=", "<=", ">=", "<", ">", "=",
			"(", ")", "{", "}", "[", "]",
			";", ":", ",", ".", "..", "...",
		},

		IdentChars = chararray("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789"),
		NumberChars = chararray("0123456789"),
		HexNumberChars = chararray("0123456789abcdefABCDEF"),
		BinaryNumberChars = {"0", "1"},
		DecimalExponent = {"e", "E"},
		HexadecimalNums = {"x", "X"},
		BinaryNums = {"b", "B"},
		DecimalSeperators = false,

		EscapeSequences = {
			["a"] = "\\a";
			["b"] = "\\b";
			["f"] = "\\f";
			["n"] = "\\n";
			["r"] = "\\r";
			["t"] = "\\t";
			["v"] = "\\v";
			["\\\\"] = "\\\\";
			["\\""] = "\\"";
			["\\'"] = "\\'";
		},
		NumericalEscapes = true,
		EscapeZIgnoreNextWhitespace = true,
		HexEscapes = true,
		UnicodeEscapes = true,
	},
	[Enums.LuaVersion.LuaU] = {
		Keywords = {
			"and", "break", "do", "else", "elseif", "continue",
			"end", "false", "for", "function", "if",
			"in", "local", "nil", "not", "or",
			"repeat", "return", "then", "true", "until", "while"
		},

		SymbolChars = chararray("+-*/%^#=~<>(){}[];:,."),
		MaxSymbolLength = 3,
		Symbols = {
			"+", "-", "*", "/", "%", "^", "#",
			"==", "~=", "<=", ">=", "<", ">", "=",
			"+=", "-=", "/=", "%=", "^=", "..=", "*=",
			"(", ")", "{", "}", "[", "]",
			";", ":", ",", ".", "..", "...",
			"::", "->", "?", "|", "&",
		},

		IdentChars = chararray("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789"),
		NumberChars = chararray("0123456789"),
		HexNumberChars = chararray("0123456789abcdefABCDEF"),
		BinaryNumberChars = {"0", "1"},
		DecimalExponent = {"e", "E"},
		HexadecimalNums = {"x", "X"},
		BinaryNums = {"b", "B"},
		DecimalSeperators = {"_"},

		EscapeSequences = {
			["a"] = "\\a";
			["b"] = "\\b";
			["f"] = "\\f";
			["n"] = "\\n";
			["r"] = "\\r";
			["t"] = "\\t";
			["v"] = "\\v";
			["\\\\"] = "\\\\";
			["\\""] = "\\"";
			["\\'"] = "\\'";
		},
		NumericalEscapes = true,
		EscapeZIgnoreNextWhitespace = true,
		HexEscapes = true,
		UnicodeEscapes = true,
	},
}

return Enums;
`,"prometheus.namegenerators.confuse":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- namegenerators/confuse.lua
--
-- This Script provides a function for generation of confusing variable names

local util = require("prometheus.util");

local varNames = {
    "index",
    "iterator",
    "length",
    "size",
    "key",
    "value",
    "data",
    "count",
    "increment",
    "include",
    "string",
    "number",
    "type",
    "void",
    "int",
    "float",
    "bool",
    "char",
    "double",
    "long",
    "short",
    "unsigned",
    "signed",
    "program",
    "factory",
    "Factory",
    "new",
    "delete",
    "table",
    "array",
    "object",
    "class",
    "arr",
    "obj",
    "cls",
    "dir",
    "directory",
    "isWindows",
    "isLinux",
    "game",
    "roblox",
    "gmod",
    "gsub",
    "gmatch",
    "gfind",
    "onload",
    "load",
    "loadstring",
    "loadfile",
    "dofile",
    "require",
    "parse",
    "byte",
    "code",
    "bytecode",
    "idx",
    "const",
    "loader",
    "loaders",
    "module",
    "export",
    "exports",
    "import",
    "imports",
    "package",
    "packages",
    "_G",
    "math",
    "os",
    "io",
    "write",
    "print",
    "read",
    "readline",
    "readlines",
    "close",
    "flush",
    "open",
    "popen",
    "tmpfile",
    "tmpname",
    "rename",
    "remove",
    "seek",
    "setvbuf",
    "lines",
    "call",
    "apply",
    "raise",
    "pcall",
    "xpcall",
    "coroutine",
    "create",
    "resume",
    "status",
    "wrap",
    "yield",
    "debug",
    "traceback",
    "getinfo",
    "getlocal",
    "setlocal",
    "getupvalue",
    "setupvalue",
    "getuservalue",
    "setuservalue",
    "upvalueid",
    "upvaluejoin",
    "sethook",
    "gethook",
    "hookfunction",
    "hooks",
    "error",
    "setmetatable",
    "getmetatable",
    "rand",
    "randomseed",
    "next",
    "ipairs",
    "hasnext",
    "loadlib",
    "searchpath",
    "oldpath",
    "newpath",
    "path",
    "rawequal",
    "rawset",
    "rawget",
    "rawnew",
    "rawlen",
    "select",
    "tonumber",
    "tostring",
    "assert",
    "collectgarbage",
    "a", "b", "c", "i", "j", "m",
}

local function generateName(id, _)
    local name = {};
    local d = id % #varNames
	id = (id - d) / #varNames
	table.insert(name, varNames[d + 1]);
	while id > 0 do
		local e = id % #varNames
		id = (id - e) / #varNames
		table.insert(name, varNames[e + 1]);
	end
	return table.concat(name, "_");
end

local function prepare(_)
    util.shuffle(varNames);
end

return {
	generateName = generateName,
	prepare = prepare
};
`,"prometheus.namegenerators.Il":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- namegenerators/il.lua
--
-- This Script provides a function for generation of weird names consisting of I, l and 1

local MIN_CHARACTERS = 5;
local MAX_INITIAL_CHARACTERS = 10;


local util = require("prometheus.util");
local chararray = util.chararray;

local offset = 0;
local VarDigits = chararray("Il1");
local VarStartDigits = chararray("Il");

local function generateName(id, _)
	local name = ''
	id = id + offset;
	local d = id % #VarStartDigits
	id = (id - d) / #VarStartDigits
	name = name..VarStartDigits[d+1]
	while id > 0 do
		local e = id % #VarDigits
		id = (id - e) / #VarDigits
		name = name..VarDigits[e+1]
	end
	return name
end

local function prepare(_)
	util.shuffle(VarDigits);
	util.shuffle(VarStartDigits);
	offset = math.random(3 ^ MIN_CHARACTERS, 3 ^ MAX_INITIAL_CHARACTERS);
end

return {
	generateName = generateName,
	prepare = prepare
};
`,"prometheus.namegenerators.mangled":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- namegenerators/mangled.lua
--
-- This Script provides a function for generation of mangled names


local util = require("prometheus.util");
local chararray = util.chararray;

local VarDigits = chararray("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_");
local VarStartDigits = chararray("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");

return function(id, _)
	local name = ''
	local d = id % #VarStartDigits
	id = (id - d) / #VarStartDigits
	name = name..VarStartDigits[d+1]
	while id > 0 do
		local e = id % #VarDigits
		id = (id - e) / #VarDigits
		name = name..VarDigits[e+1]
	end
	return name
end`,"prometheus.namegenerators.mangled_shuffled":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- namegenerators/mangled_shuffled.lua
--
-- This Script provides a function for generation of mangled names with shuffled character order


local util = require("prometheus.util");
local chararray = util.chararray;

local VarDigits = chararray("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_");
local VarStartDigits = chararray("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");

local function generateName(id, _)
	local name = ''
	local d = id % #VarStartDigits
	id = (id - d) / #VarStartDigits
	name = name..VarStartDigits[d+1]
	while id > 0 do
		local e = id % #VarDigits
		id = (id - e) / #VarDigits
		name = name..VarDigits[e+1]
	end
	return name
end

local function prepare(_)
	util.shuffle(VarDigits);
	util.shuffle(VarStartDigits);
end

return {
	generateName = generateName,
	prepare = prepare
};`,"prometheus.namegenerators.number":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- namegenerators/number.lua
--
-- This Script provides a function for generation of simple up counting names but with hex numbers

local PREFIX = "_";

return function(id, _)
	return PREFIX .. tostring(id);
end
`,"prometheus.namegenerators":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- namegenerators.lua
--
-- This Script provides a collection of name generators for Prometheus.

return {
	Mangled = require("prometheus.namegenerators.mangled");
	MangledShuffled = require("prometheus.namegenerators.mangled_shuffled");
	Il = require("prometheus.namegenerators.Il");
	Number = require("prometheus.namegenerators.number");
	Confuse = require("prometheus.namegenerators.confuse");
}`,"prometheus.parser":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- parser.lua
-- Overview:
-- This Script provides a class for parsing of lua code.
-- This Parser is Capable of parsing LuaU and Lua5.1
--
-- Note that when parsing LuaU "continue" is treated as a Keyword, so no variable may be named "continue" even though this would be valid in LuaU
--
-- Settings Object:
-- luaVersion : The LuaVersion of the Script - Currently Supported : Lua51 and LuaU
--

local Tokenizer = require("prometheus.tokenizer");
local Enums = require("prometheus.enums");
local util = require("prometheus.util");
local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");
local logger = require("logger");

local AstKind = Ast.AstKind;

local LuaVersion = Enums.LuaVersion;
local lookupify = util.lookupify;

local TokenKind = Tokenizer.TokenKind;

local Parser = {};

local ASSIGNMENT_NO_WARN_LOOKUP = lookupify{
	AstKind.NilExpression,
	AstKind.FunctionCallExpression,
	AstKind.PassSelfFunctionCallExpression,
	AstKind.VarargExpression
};

local CALLABLE_PREFIX_EXPRESSION_LOOKUP = lookupify{
	AstKind.VariableExpression,
	AstKind.IndexExpression,
	AstKind.FunctionCallExpression,
	AstKind.PassSelfFunctionCallExpression
};

local function generateError(self, message)
	local token;
	if(self.index > self.length) then
		token = self.tokens[self.length];
	elseif(self.index < 1) then
		return "Parsing Error at Position 0:0, " .. message;
	else
		token = self.tokens[self.index];
	end

	return "Parsing Error at Position " .. tostring(token.line) .. ":" .. tostring(token.linePos) .. ", " .. message;
end

local function generateWarning(token, message)
	return "Warning at Position " .. tostring(token.line) .. ":" .. tostring(token.linePos) .. ", " .. message;
end

function Parser:new(settings)
	local luaVersion = (settings and (settings.luaVersion or settings.LuaVersion)) or LuaVersion.LuaU;
	local parser = {
		luaVersion = luaVersion,
		tokenizer = Tokenizer:new({
			luaVersion = luaVersion
		}),
		tokens = {};
		length = 0;
		index = 0;
	};

	setmetatable(parser, self);
	self.__index = self;

	return parser;
end

-- Function to peek the n'th token
local function peek(self, n)
	n = n or 0;
	local i = self.index + n + 1;
	if i > self.length then
		return Tokenizer.EOF_TOKEN;
	end
	return self.tokens[i];
end

-- Function to get the next Token
local function get(self)
	local i = self.index + 1;
	if i > self.length then
		error(generateError(self, "Unexpected end of Input"));
	end
	self.index = self.index + 1;
	local tk = self.tokens[i];

	return tk;
end

local function is(self, kind, sourceOrN, n)
	local token = peek(self, n);

	local source = nil;
	if(type(sourceOrN) == "string") then
		source = sourceOrN;
	else
		n = sourceOrN;
	end
	n = n or 0;

	if(token.kind == kind) then
		if(source == nil or token.source == source) then
			return true;
		end
	end

	return false;
end

local function consume(self, kind, source)
	if(is(self, kind, source)) then
		self.index = self.index + 1;
		return true;
	end
	return false;
end

local function expect(self, kind, source)
	if(is(self, kind, source, 0)) then
		return get(self);
	end

	local token = peek(self);
	if self.disableLog then error() end
	if(source) then
		logger:error(generateError(self, string.format("unexpected token <%s> \\"%s\\", expected <%s> \\"%s\\"", token.kind, token.source, kind, source)));
	else
		logger:error(generateError(self, string.format("unexpected token <%s> \\"%s\\", expected <%s>", token.kind, token.source, kind)));
	end
end

-- Parse the given code to an Abstract Syntax Tree
function Parser:parse(code)
	self.tokenizer:append(code);
	self.tokens = self.tokenizer:scanAll();
	self.length = #self.tokens;

	-- Create Global Variable Scope
	local globalScope = Scope:newGlobal();

	local ast = Ast.TopNode(self:block(globalScope, false), globalScope);
	-- File Must be Over when Top Node is Fully Parsed
	expect(self, TokenKind.Eof);

	logger:debug("Cleaning up Parser for next Use ...")
	-- Clean Up
	self.tokenizer:reset();
	self.tokens = {};
	self.index = 0;
	self.length = 0;

	logger:debug("Cleanup Done")

	return ast;
end

-- Parse a Code Block
function Parser:block(parentScope, currentLoop, scope)
	scope = scope or Scope:new(parentScope);
	local statements = {};

	repeat
		local statement, isTerminatingStatement = self:statement(scope, currentLoop);
		table.insert(statements, statement);
	until isTerminatingStatement or not statement

	-- Consume Eventual Semicolon after terminating return, break or continue
	consume(self, TokenKind.Symbol, ";");

	return Ast.Block(statements, scope);
end

function Parser:statement(scope, currentLoop)
	-- Skip all semicolons before next real statement
	-- NOP statements are therefore ignored
	while(consume(self, TokenKind.Symbol, ";")) do

	end

	-- Break Statement - only valid inside of Loops
	if(consume(self, TokenKind.Keyword, "break")) then
		if(not currentLoop) then
			if self.disableLog then error() end;
			logger:error(generateError(self, "the break Statement is only valid inside of loops"));
		end
		-- Return true as Second value because break must be the last Statement in a block
		return Ast.BreakStatement(currentLoop, scope), true;
	end

	-- Continue Statement - only valid inside of Loops - only valid in LuaU
	if(self.luaVersion == LuaVersion.LuaU and consume(self, TokenKind.Keyword, "continue")) then
		if(not currentLoop) then
			if self.disableLog then error() end;
			logger:error(generateError(self, "the continue Statement is only valid inside of loops"));
		end
		-- Return true as Second value because continue must be the last Statement in a block
		return Ast.ContinueStatement(currentLoop, scope), true;
	end

	-- do ... end Statement
	if(consume(self, TokenKind.Keyword, "do")) then
		local body = self:block(scope, currentLoop);
		expect(self, TokenKind.Keyword, "end");
		return Ast.DoStatement(body);
	end

	-- While Statement
	if(consume(self, TokenKind.Keyword, "while")) then
		local condition = self:expression(scope);
		expect(self, TokenKind.Keyword, "do");
		local stat = Ast.WhileStatement(nil, condition, scope);
		stat.body = self:block(scope, stat);
		expect(self, TokenKind.Keyword, "end");
		return stat;
	end

	-- Repeat Statement
	if(consume(self, TokenKind.Keyword, "repeat")) then
		local repeatScope = Scope:new(scope);
		local stat = Ast.RepeatStatement(nil, nil, scope);
		stat.body = self:block(nil, stat, repeatScope);
		expect(self, TokenKind.Keyword, "until");
		stat.condition = self:expression(repeatScope);
		return stat;
	end

	-- Return Statement
	if(consume(self, TokenKind.Keyword, "return")) then
		local args = {};
		if(not is(self, TokenKind.Keyword, "end") and not is(self, TokenKind.Keyword, "elseif") and not is(self, TokenKind.Keyword, "else") and not is(self, TokenKind.Symbol, ";") and not is(self, TokenKind.Eof)) then
			args = self:exprList(scope);
		end
		-- Return true as Second value because return must be the last Statement in a block
		return Ast.ReturnStatement(args), true;
	end

	-- If Statement
	if(consume(self, TokenKind.Keyword, "if")) then
		local condition = self:expression(scope);
		expect(self, TokenKind.Keyword, "then");
		local body = self:block(scope, currentLoop);

		local elseifs = {};
		-- Elseifs
		while(consume(self, TokenKind.Keyword, "elseif")) do
			local condition = self:expression(scope);
			expect(self, TokenKind.Keyword, "then");
			local body = self:block(scope, currentLoop);

			table.insert(elseifs, {
				condition = condition,
				body = body,
			});
		end

		local elsebody = nil;
		-- Else
		if(consume(self, TokenKind.Keyword, "else")) then
			elsebody = self:block(scope, currentLoop);
		end

		expect(self, TokenKind.Keyword, "end");

		return Ast.IfStatement(condition, body, elseifs, elsebody);
	end

	-- Function Declaration
	if(consume(self, TokenKind.Keyword, "function")) then
		-- TODO: Parse Function Declaration Name
		local obj = self:funcName(scope);
		local baseScope = obj.scope;
		local baseId = obj.id;
		local indices = obj.indices;

		local funcScope = Scope:new(scope);

		expect(self, TokenKind.Symbol, "(");
		local args = self:functionArgList(funcScope);
		expect(self, TokenKind.Symbol, ")");

		if(obj.passSelf) then
			local id = funcScope:addVariable("self", obj.token);
			table.insert(args, 1, Ast.VariableExpression(funcScope, id));
		end

		local body = self:block(nil, false, funcScope);
		expect(self, TokenKind.Keyword, "end");

		return Ast.FunctionDeclaration(baseScope, baseId, indices, args, body);
	end

	-- Local Function or Variable Declaration
	if(consume(self, TokenKind.Keyword, "local")) then
		-- Local Function Declaration
		if(consume(self, TokenKind.Keyword, "function")) then
			local ident = expect(self, TokenKind.Ident);
			local name = ident.value;

			local id = scope:addVariable(name, ident);
			local funcScope = Scope:new(scope);

			expect(self, TokenKind.Symbol, "(");
			local args = self:functionArgList(funcScope);
			expect(self, TokenKind.Symbol, ")");

			local body = self:block(nil, false, funcScope);
			expect(self, TokenKind.Keyword, "end");

			return Ast.LocalFunctionDeclaration(scope, id, args, body);
		end

		-- Local Variable Declaration
		local ids = self:nameList(scope);
		local expressions = {};
		if(consume(self, TokenKind.Symbol, "=")) then
			expressions = self:exprList(scope);
		end

		-- Variables can only be reffered to in the next statement, so the id's are enabled after the expressions have been parsed
		self:enableNameList(scope, ids);

		if(#expressions > #ids) then
			logger:warn(generateWarning(peek(self, -1), string.format("assigning %d values to %d variable" .. ((#ids > 1 and "s") or ""), #expressions, #ids)));
		elseif(#ids > #expressions and #expressions > 0 and not ASSIGNMENT_NO_WARN_LOOKUP[expressions[#expressions].kind]) then
			logger:warn(generateWarning(peek(self, -1), string.format("assigning %d value" .. ((#expressions > 1 and "s") or "") ..
				" to %d variables initializes extra variables with nil, add a nil value to silence", #expressions, #ids)));
		end
		return Ast.LocalVariableDeclaration(scope, ids, expressions);
	end

	-- For Statement
	if(consume(self, TokenKind.Keyword, "for")) then
		-- Normal for Statement
		if(is(self, TokenKind.Symbol, "=", 1)) then
			local forScope = Scope:new(scope);

			local ident = expect(self, TokenKind.Ident);
			local varId = forScope:addDisabledVariable(ident.value, ident);

			expect(self, TokenKind.Symbol, "=");
			local initialValue = self:expression(scope);

			expect(self, TokenKind.Symbol, ",");
			local finalValue = self:expression(scope);
			local incrementBy = Ast.NumberExpression(1);
			if(consume(self, TokenKind.Symbol, ",")) then
				incrementBy = self:expression(scope);
			end

			local stat = Ast.ForStatement(forScope, varId, initialValue, finalValue, incrementBy, nil, scope);
			forScope:enableVariable(varId);
			expect(self, TokenKind.Keyword, "do");
			stat.body = self:block(nil, stat, forScope);
			expect(self, TokenKind.Keyword, "end");
			return stat;
		end

		-- For ... in ... statement
		local forScope = Scope:new(scope);

		local ids = self:nameList(forScope);
		expect(self, TokenKind.Keyword, "in");
		local expressions = self:exprList(scope);
		-- Enable Ids after Expression Parsing so that code like this works:
		--	local z = {10,20}
		--	for y,z in ipairs(z) do
		--		print(y, z);
		-- 	end
		self:enableNameList(forScope, ids);
		expect(self, TokenKind.Keyword, "do");
		local stat = Ast.ForInStatement(forScope, ids, expressions, nil, scope);
		stat.body = self:block(nil, stat, forScope);
		expect(self, TokenKind.Keyword, "end");

		return stat;
	end

	local expr = self:primaryExpression(scope);
	-- Variable Assignment or Function Call
	if expr then
		-- Function Call Statement
		if(expr.kind == AstKind.FunctionCallExpression) then
			return Ast.FunctionCallStatement(expr.base, expr.args);
		end

		-- Function Call Statement passing self
		if(expr.kind == AstKind.PassSelfFunctionCallExpression) then
			return Ast.PassSelfFunctionCallStatement(expr.base, expr.passSelfFunctionName, expr.args);
		end

		-- Variable Assignment
		if(expr.kind == AstKind.IndexExpression or expr.kind == AstKind.VariableExpression) then
			if(expr.kind == AstKind.IndexExpression) then
				expr.kind = AstKind.AssignmentIndexing
			end
			if(expr.kind == AstKind.VariableExpression) then
				expr.kind = AstKind.AssignmentVariable
			end

			if(self.luaVersion == LuaVersion.LuaU) then
				-- LuaU Compound Assignment
				if(consume(self, TokenKind.Symbol, "+=")) then
					local rhs = self:expression(scope);
					return Ast.CompoundAddStatement(expr, rhs);
				end

				if(consume(self, TokenKind.Symbol, "-=")) then
					local rhs = self:expression(scope);
					return Ast.CompoundSubStatement(expr, rhs);
				end

				if(consume(self, TokenKind.Symbol, "*=")) then
					local rhs = self:expression(scope);
					return Ast.CompoundMulStatement(expr, rhs);
				end

				if(consume(self, TokenKind.Symbol, "/=")) then
					local rhs = self:expression(scope);
					return Ast.CompoundDivStatement(expr, rhs);
				end

				if(consume(self, TokenKind.Symbol, "%=")) then
					local rhs = self:expression(scope);
					return Ast.CompoundModStatement(expr, rhs);
				end

				if(consume(self, TokenKind.Symbol, "^=")) then
					local rhs = self:expression(scope);
					return Ast.CompoundPowStatement(expr, rhs);
				end

				if(consume(self, TokenKind.Symbol, "..=")) then
					local rhs = self:expression(scope);
					return Ast.CompoundConcatStatement(expr, rhs);
				end
			end

			local lhs = {
				expr
			}

			while consume(self, TokenKind.Symbol, ",") do
				expr = self:primaryExpression(scope);

				if(not expr) then
					if self.disableLog then error() end;
					logger:error(generateError(self, string.format("expected a valid assignment statement lhs part but got nil")));
				end

				if(expr.kind == AstKind.IndexExpression or expr.kind == AstKind.VariableExpression) then
					if(expr.kind == AstKind.IndexExpression) then
						expr.kind = AstKind.AssignmentIndexing
					end
					if(expr.kind == AstKind.VariableExpression) then
						expr.kind = AstKind.AssignmentVariable
					end
					table.insert(lhs, expr);
				else
					if self.disableLog then error() end;
					logger:error(generateError(self, string.format("expected a valid assignment statement lhs part but got <%s>", expr.kind)));
				end
			end

			expect(self, TokenKind.Symbol, "=");

			local rhs = self:exprList(scope);

			return Ast.AssignmentStatement(lhs, rhs);
		end

		if self.disableLog then error() end;
		logger:error(generateError(self, "expressions are not valid statements!"));
	end

	return nil;
end

function Parser:primaryExpression(scope)
	local i = self.index;
	local s = self;
	self.disableLog = true;
	local status, val = pcall(self.expressionFunctionCall, self, scope);
	self.disableLog = false;
	if(status) then
		return val;
	else
		self.index = i;
		return nil;
	end
end

-- List of expressions Seperated by a comma
function Parser:exprList(scope)
	local expressions = {
		self:expression(scope)
	};
	while(consume(self, TokenKind.Symbol, ",")) do
		table.insert(expressions, self:expression(scope));
	end
	return expressions;
end

-- list of local variable names
function Parser:nameList(scope)
	local ids = {};

	local ident = expect(self, TokenKind.Ident);
	local id = scope:addDisabledVariable(ident.value, ident);
	table.insert(ids, id);

	while(consume(self, TokenKind.Symbol, ",")) do
		ident = expect(self, TokenKind.Ident);
		id = scope:addDisabledVariable(ident.value, ident);
		table.insert(ids, id);
	end

	return ids;
end

function Parser:enableNameList(scope, list)
	for i, id in ipairs(list) do
		scope:enableVariable(id);
	end
end


-- function name
function Parser:funcName(scope)
	local ident = expect(self, TokenKind.Ident);
	local baseName = ident.value;

	local baseScope, baseId = scope:resolve(baseName);

	local indices = {};
	local passSelf = false;
	while(consume(self, TokenKind.Symbol, ".")) do
		table.insert(indices, expect(self, TokenKind.Ident).value);
	end

	if(consume(self, TokenKind.Symbol, ":")) then
		table.insert(indices, expect(self, TokenKind.Ident).value);
		passSelf = true;
	end

	return {
		scope = baseScope,
		id = baseId,
		indices = indices,
		passSelf = passSelf,
		token = ident,
	};
end

-- Expression
function Parser:expression(scope)
	return self:expressionOr(scope);
end

function Parser:expressionOr(scope)
	local lhs = self:expressionAnd(scope);

	if(consume(self, TokenKind.Keyword, "or")) then
		local rhs = self:expressionOr(scope);
		return Ast.OrExpression(lhs, rhs, true);
	end

	return lhs;
end

function Parser:expressionAnd(scope)
	local lhs = self:expressionComparision(scope);

	if(consume(self, TokenKind.Keyword, "and")) then
		local rhs = self:expressionAnd(scope);
		return Ast.AndExpression(lhs, rhs, true);
	end

	return lhs;
end

function Parser:expressionComparision(scope)
	local curr = self:expressionStrCat(scope);
	repeat
		local found = false;
		if(consume(self, TokenKind.Symbol, "<")) then
			local rhs = self:expressionStrCat(scope);
			curr = Ast.LessThanExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, ">")) then
			local rhs = self:expressionStrCat(scope);
			curr = Ast.GreaterThanExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, "<=")) then
			local rhs = self:expressionStrCat(scope);
			curr = Ast.LessThanOrEqualsExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, ">=")) then
			local rhs = self:expressionStrCat(scope);
			curr = Ast.GreaterThanOrEqualsExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, "~=")) then
			local rhs = self:expressionStrCat(scope);
			curr = Ast.NotEqualsExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, "==")) then
			local rhs = self:expressionStrCat(scope);
			curr = Ast.EqualsExpression(curr, rhs, true);
			found = true;
		end
	until not found;

	return curr;
end

function Parser:expressionStrCat(scope)
	local lhs = self:expressionAddSub(scope);

	if(consume(self, TokenKind.Symbol, "..")) then
		local rhs = self:expressionStrCat(scope);
		return Ast.StrCatExpression(lhs, rhs, true);
	end

	return lhs;
end

function Parser:expressionAddSub(scope)
	local curr = self:expressionMulDivMod(scope);

	repeat
		local found = false;
		if(consume(self, TokenKind.Symbol, "+")) then
			local rhs = self:expressionMulDivMod(scope);
			curr = Ast.AddExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, "-")) then
			local rhs = self:expressionMulDivMod(scope);
			curr = Ast.SubExpression(curr, rhs, true);
			found = true;
		end
	until not found;


	return curr;
end

function Parser:expressionMulDivMod(scope)
	local curr = self:expressionUnary(scope);

	repeat
		local found = false;
		if(consume(self, TokenKind.Symbol, "*")) then
			local rhs = self:expressionUnary(scope);
			curr = Ast.MulExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, "/")) then
			local rhs = self:expressionUnary(scope);
			curr = Ast.DivExpression(curr, rhs, true);
			found = true;
		end

		if(consume(self, TokenKind.Symbol, "%")) then
			local rhs = self:expressionUnary(scope);
			curr = Ast.ModExpression(curr, rhs, true);
			found = true;
		end
	until not found;

	return curr;
end

function Parser:expressionUnary(scope)
	if(consume(self, TokenKind.Keyword, "not")) then
		local rhs = self:expressionUnary(scope);
		return Ast.NotExpression(rhs, true);
	end

	if(consume(self, TokenKind.Symbol, "#")) then
		local rhs = self:expressionUnary(scope);
		return Ast.LenExpression(rhs, true);
	end

	if(consume(self, TokenKind.Symbol, "-")) then
		local rhs = self:expressionUnary(scope);
		return Ast.NegateExpression(rhs, true);
	end

	return self:expressionPow(scope);
end

function Parser:expressionPow(scope)
	local lhs = self:tableOrFunctionLiteral(scope);

	if(consume(self, TokenKind.Symbol, "^")) then
		-- Allow unary operators on the rhs (e.g. 2 ^ #x, 2 ^ -x) while preserving right-associativity. ~ SpinnySpiwal
		local rhs = self:expressionUnary(scope);
		return Ast.PowExpression(lhs, rhs, true);
	end

	return lhs;
end

-- Table Literals and Function Literals cannot directly be called or indexed
function Parser:tableOrFunctionLiteral(scope)

	if(is(self, TokenKind.Symbol, "{")) then
		return self:tableConstructor(scope);
	end

	if(is(self, TokenKind.Keyword, "function")) then
		return self:expressionFunctionLiteral(scope);
	end

	return self:expressionFunctionCall(scope);
end

function Parser:expressionFunctionLiteral(parentScope)
	local scope = Scope:new(parentScope);

	expect(self, TokenKind.Keyword, "function");

	expect(self, TokenKind.Symbol, "(");
	local args = self:functionArgList(scope);
	expect(self, TokenKind.Symbol, ")");

	local body = self:block(nil, false, scope);
	expect(self, TokenKind.Keyword, "end");

	return Ast.FunctionLiteralExpression(args, body);
end

function Parser:functionArgList(scope)
	local args = {};
	if(consume(self, TokenKind.Symbol, "...")) then
		table.insert(args, Ast.VarargExpression());
		return args;
	end

	if(is(self, TokenKind.Ident)) then
		local ident = get(self);
		local name = ident.value;

		local id = scope:addVariable(name, ident);
		table.insert(args, Ast.VariableExpression(scope, id));

		while(consume(self, TokenKind.Symbol, ",")) do
			if(consume(self, TokenKind.Symbol, "...")) then
				table.insert(args, Ast.VarargExpression());
				return args;
			end

			ident = get(self);
			name = ident.value;

			id = scope:addVariable(name, ident);
			table.insert(args, Ast.VariableExpression(scope, id));
		end
	end

	return args;
end

function Parser:expressionFunctionCall(scope, base)
	base = base or self:expressionIndex(scope);

	if(not (base and (CALLABLE_PREFIX_EXPRESSION_LOOKUP[base.kind] or base.isParenthesizedExpression))) then
		return base;
	end

	-- Normal Function Call
	local args = {};
	if(is(self, TokenKind.String)) then
		args = {
			Ast.StringExpression(get(self).value),
		};
	elseif(is(self, TokenKind.Symbol, "{")) then
		args = {
			self:tableConstructor(scope),
		};
	elseif(consume(self, TokenKind.Symbol, "(")) then
		if(not is(self, TokenKind.Symbol, ")")) then
			args = self:exprList(scope);
		end
		expect(self, TokenKind.Symbol, ")");
	else
		return base;
	end

	local node = Ast.FunctionCallExpression(base, args);

	-- the result of a function call can be indexed
	if(is(self, TokenKind.Symbol, ".") or is(self, TokenKind.Symbol, "[") or is(self, TokenKind.Symbol, ":")) then
		return self:expressionIndex(scope, node);
	end

	-- The result of a function call can be a function that is again called
	if(is(self, TokenKind.Symbol, "(") or is(self, TokenKind.Symbol, "{") or is(self, TokenKind.String)) then
		return self:expressionFunctionCall(scope, node);
	end

	return node;
end

function Parser:expressionIndex(scope, base)
	base = base or self:expressionLiteral(scope);

	-- Parse Indexing Expressions
	while(consume(self, TokenKind.Symbol, "[")) do
		local expr = self:expression(scope);
		expect(self, TokenKind.Symbol, "]");
		base = Ast.IndexExpression(base, expr);
	end

	-- Parse Indexing Expressions
	while consume(self, TokenKind.Symbol, ".") do
		local ident = expect(self, TokenKind.Ident);
		base = Ast.IndexExpression(base, Ast.StringExpression(ident.value));

		while(consume(self, TokenKind.Symbol, "[")) do
			local expr = self:expression(scope);
			expect(self, TokenKind.Symbol, "]");
			base = Ast.IndexExpression(base, expr);
		end
	end

	-- Function Passing self
	if(consume(self, TokenKind.Symbol, ":")) then
		local passSelfFunctionName = expect(self, TokenKind.Ident).value;
		local args = {};
		if(is(self, TokenKind.String)) then
			args = {
				Ast.StringExpression(get(self).value),
			};
		elseif(is(self, TokenKind.Symbol, "{")) then
			args = {
				self:tableConstructor(scope),
			};
		else
			expect(self, TokenKind.Symbol, "(");
			if(not is(self, TokenKind.Symbol, ")")) then
				args = self:exprList(scope);
			end
			expect(self, TokenKind.Symbol, ")");
		end

		local node = Ast.PassSelfFunctionCallExpression(base, passSelfFunctionName, args);

		-- the result of a function call can be indexed
		if(is(self, TokenKind.Symbol, ".") or is(self, TokenKind.Symbol, "[") or is(self, TokenKind.Symbol, ":")) then
			return self:expressionIndex(scope, node);
		end

		-- The result of a function call can be a function that is again called
		if(is(self, TokenKind.Symbol, "(") or is(self, TokenKind.Symbol, "{") or is(self, TokenKind.String)) then
			return self:expressionFunctionCall(scope, node);
		end

		return node
	end

	-- The result of a function call can be a function that is again called
	if(is(self, TokenKind.Symbol, "(") or is(self, TokenKind.Symbol, "{") or is(self, TokenKind.String)) then
		return self:expressionFunctionCall(scope, base);
	end

	return base;
end

function Parser:expressionLiteral(scope)
	-- () expression
	if(consume(self, TokenKind.Symbol, "(")) then
		local expr = self:expression(scope);
		expect(self, TokenKind.Symbol, ")");
		if expr then
			expr.isParenthesizedExpression = true;
		end
		return expr;
	end

	-- String Literal
	if(is(self, TokenKind.String)) then
		return Ast.StringExpression(get(self).value);
	end

	-- Number Literal
	if(is(self, TokenKind.Number)) then
		return Ast.NumberExpression(get(self).value);
	end

	-- True Literal
	if(consume(self, TokenKind.Keyword, "true")) then
		return Ast.BooleanExpression(true);
	end

	-- False Literal
	if(consume(self, TokenKind.Keyword, "false")) then
		return Ast.BooleanExpression(false);
	end

	-- Nil Literal
	if(consume(self, TokenKind.Keyword, "nil")) then
		return Ast.NilExpression();
	end

	-- Vararg Literal
	if(consume(self, TokenKind.Symbol, "...")) then
		return Ast.VarargExpression();
	end

	-- Variable
	if(is(self, TokenKind.Ident)) then
		local ident = get(self);
		local name = ident.value;

		local scope, id = scope:resolve(name);
		return Ast.VariableExpression(scope, id);
	end

	-- IfElse
	if(LuaVersion.LuaU) then
		if(consume(self, TokenKind.Keyword, "if")) then
			local condition = self:expression(scope);
			expect(self, TokenKind.Keyword, "then");
			local true_value = self:expression(scope);

			local elseifs = {}
			while(consume(self, TokenKind.Keyword, "elseif")) do
				local elseif_condition = self:expression(scope);
				expect(self, TokenKind.Keyword, "then");
				local elseif_value = self:expression(scope);

				table.insert(elseifs, {
					condition = elseif_condition,
					value = elseif_value
				});
			end

			expect(self, TokenKind.Keyword, "else");
			local false_value = self:expression(scope);

			return Ast.IfElseExpression(condition, true_value, elseifs, false_value);
		end
	end

	if(self.disableLog) then error() end
	logger:error(generateError(self, "Unexpected Token \\"" .. peek(self).source .. "\\". Expected a Expression!"))
end

function Parser:tableConstructor(scope)
	-- TODO: Parse Table Literals
	local entries = {};

	expect(self, TokenKind.Symbol, "{");

	while (not consume(self, TokenKind.Symbol, "}")) do
		if(consume(self, TokenKind.Symbol, "[")) then
			local key = self:expression(scope);
			expect(self, TokenKind.Symbol, "]");
			expect(self, TokenKind.Symbol, "=");
			local value = self:expression(scope);
			table.insert(entries, Ast.KeyedTableEntry(key, value));
		elseif(is(self, TokenKind.Ident, 0) and is(self, TokenKind.Symbol, "=", 1)) then
			local key = Ast.StringExpression(get(self).value);
			expect(self, TokenKind.Symbol, "=");
			local value = self:expression(scope);
			table.insert(entries, Ast.KeyedTableEntry(key, value));
		else
			local value = self:expression(scope);
			table.insert(entries, Ast.TableEntry(value));
		end


		if (not consume(self, TokenKind.Symbol, ";") and not consume(self, TokenKind.Symbol, ",") and not is(self, TokenKind.Symbol, "}")) then
			if self.disableLog then error() end
			logger:error(generateError(self, "expected a \\";\\" or a \\",\\""));
		end
	end

	return Ast.TableConstructorExpression(entries);
end

return Parser
`,"prometheus.pipeline":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- pipeline.lua
--
-- This Script provides a configurable obfuscation pipeline that can obfuscate code using different modules
-- These modules can simply be added to the pipeline.

local Enums = require("prometheus.enums");
local util = require("prometheus.util");
local Parser = require("prometheus.parser");
local Unparser = require("prometheus.unparser");
local logger = require("logger");

local NameGenerators = require("prometheus.namegenerators");

local Steps = require("prometheus.steps");
local LuaVersion = Enums.LuaVersion;

-- On Windows, os.clock can be used. On other systems, os.time must be used for benchmarking.
local isWindows = package and package.config and type(package.config) == "string" and package.config:sub(1,1) == "\\\\";
local function gettime()
	if isWindows then
		return os.clock();
	else
		return os.time();
	end
end

local Pipeline = {
	NameGenerators = NameGenerators;
	Steps = Steps;
	DefaultSettings = {
		LuaVersion = LuaVersion.LuaU; -- The Lua Version to use for the Tokenizer, Parser and Unparser
		PrettyPrint = false; -- Note that Pretty Print is currently not producing Pretty results
		Seed = 0; -- The Seed. 0 or below uses the current time as a seed
		VarNamePrefix = ""; -- The Prefix that every variable will start with
	}
}


function Pipeline:new(settings)
	local luaVersion = settings.luaVersion or settings.LuaVersion or Pipeline.DefaultSettings.LuaVersion;
	local conventions = Enums.Conventions[luaVersion];
	if(not conventions) then
		logger:error("The Lua Version \\"" .. luaVersion
			.. "\\" is not recognized by the Tokenizer! Please use one of the following: \\"" .. table.concat(util.keys(Enums.Conventions), "\\",\\"") .. "\\"");
	end

	local prettyPrint = settings.PrettyPrint or Pipeline.DefaultSettings.PrettyPrint;
	local prefix = settings.VarNamePrefix or Pipeline.DefaultSettings.VarNamePrefix;
	local seed = settings.Seed or 0;

	local pipeline = {
		LuaVersion = luaVersion;
		PrettyPrint = prettyPrint;
		VarNamePrefix = prefix;
		Seed = seed;
		parser = Parser:new({
			LuaVersion = luaVersion;
		});
		unparser = Unparser:new({
			LuaVersion = luaVersion;
			PrettyPrint = prettyPrint;
			Highlight = settings.Highlight;
		});
		namegenerator = Pipeline.NameGenerators.MangledShuffled;
		conventions = conventions;
		steps = {};
	}

	setmetatable(pipeline, self);
	self.__index = self;

	return pipeline;
end

function Pipeline:fromConfig(config)
	config = config or {};
	local pipeline = Pipeline:new({
		LuaVersion = config.LuaVersion or LuaVersion.Lua51;
		PrettyPrint = config.PrettyPrint or false;
		VarNamePrefix = config.VarNamePrefix or "";
		Seed = config.Seed or 0;
	});

	pipeline:setNameGenerator(config.NameGenerator or "MangledShuffled")

	-- Add all Steps defined in Config
	local steps = config.Steps or {};
	for i, step in ipairs(steps) do
		if type(step.Name) ~= "string" then
			logger:error("Step.Name must be a String");
		end
		local constructor = pipeline.Steps[step.Name];
		if not constructor then
			logger:error(string.format("The Step \\"%s\\" was not found!", step.Name));
		end
		pipeline:addStep(constructor:new(step.Settings or {}));
	end

	return pipeline;
end

function Pipeline:addStep(step)
	table.insert(self.steps, step);
end

function Pipeline:resetSteps(_)
	self.steps = {};
end

function Pipeline:getSteps()
	return self.steps;
end

function Pipeline:setOption(name, _)
	assert(false, "TODO");
	if(Pipeline.DefaultSettings[name] ~= nil) then

	else
		logger:error(string.format("\\"%s\\" is not a valid setting"));
	end
end

function Pipeline:setLuaVersion(luaVersion)
	local conventions = Enums.Conventions[luaVersion];
	if(not conventions) then
		logger:error("The Lua Version \\"" .. luaVersion
			.. "\\" is not recognized by the Tokenizer! Please use one of the following: \\"" .. table.concat(util.keys(Enums.Conventions), "\\",\\"") .. "\\"");
	end

	self.parser = Parser:new({
		luaVersion = luaVersion;
	});
	self.unparser = Unparser:new({
		LuaVersion = luaVersion;
	});
	self.conventions = conventions;
end

function Pipeline:getLuaVersion()
	return self.luaVersion;
end

function Pipeline:setNameGenerator(nameGenerator)
	if(type(nameGenerator) == "string") then
		nameGenerator = Pipeline.NameGenerators[nameGenerator];
	end

	if(type(nameGenerator) == "function" or type(nameGenerator) == "table") then
		self.namegenerator = nameGenerator;
		return;
	else
		logger:error("The Argument to Pipeline:setNameGenerator must be a valid NameGenerator function or function name e.g: \\"mangled\\"")
	end
end

function Pipeline:apply(code, filename)
	local startTime = gettime();
	filename = filename or "Anonymous Script";
	logger:info(string.format("Applying Obfuscation Pipeline to %s ...", filename));

	-- Seed the Random Generator
	if(self.Seed > 0) then
		math.randomseed(self.Seed);
	else
		--> use secure random number generator
		local success, seed = pcall(function()
			local seedStr =  io.popen("openssl rand -hex 12"):read("*a"):gsub("\\n", "")..""
			local seedNum = 0;

			--> NOTE: tonumber caps at 1.844674407371e+19. So we use this instead.
			for i = 1, #seedStr do
				local char = seedStr:sub(i, i):lower()
				local digit = char:match("%d") and (char:byte() - 48) or (char:byte() - 87)
				seedNum = seedNum * 16 + digit
			end

			--> Random Number Generator in Lua 5.1 is limited to 9.007199254741e+15.
			if _VERSION == "Lua 5.1" and not jit then
				seedNum = seedNum % 9.007199254741e+15
			end

			return seedNum
		end)

		if success then
			math.randomseed(seed)
		else
			logger:warn("OpenSSL is unavailable. Falling back to unix time.");
			math.randomseed(os.time())
		end
	end

	logger:info("Parsing ...");
	local parserStartTime = gettime();

	local sourceLen = string.len(code);
	local ast = self.parser:parse(code);

	local parserTimeDiff = gettime() - parserStartTime;
	logger:info(string.format("Parsing Done in %.2f seconds", parserTimeDiff));

	-- User Defined Steps
	for i, step in ipairs(self.steps) do
		local stepStartTime = gettime();
		logger:info(string.format("Applying Step \\"%s\\" ...", step.Name or "Unnamed"));
		local newAst = step:apply(ast, self);
		if type(newAst) == "table" then
			ast = newAst;
		end
		logger:info(string.format("Step \\"%s\\" Done in %.2f seconds", step.Name or "Unnamed", gettime() - stepStartTime));
	end

	-- Rename Variables Step
	self:renameVariables(ast);

	code = self:unparse(ast);

	local timeDiff = gettime() - startTime;
	logger:info(string.format("Obfuscation Done in %.2f seconds", timeDiff));

	logger:info(string.format("Generated Code size is %.2f%% of the Source Code size", (string.len(code) / sourceLen)*100))

	return code;
end

function Pipeline:unparse(ast)
	local startTime = gettime();
	logger:info("Generating Code ...");

	local unparsed = self.unparser:unparse(ast);

	local timeDiff = gettime() - startTime;
	logger:info(string.format("Code Generation Done in %.2f seconds", timeDiff));

	return unparsed;
end

function Pipeline:renameVariables(ast)
	local startTime = gettime();
	logger:info("Renaming Variables ...");


	local generatorFunction = self.namegenerator or Pipeline.NameGenerators.mangled;
	if(type(generatorFunction) == "table") then
		if (type(generatorFunction.prepare) == "function") then
			generatorFunction.prepare(ast);
		end
		generatorFunction = generatorFunction.generateName;
	end

	if not self.unparser:isValidIdentifier(self.VarNamePrefix) and #self.VarNamePrefix ~= 0 then
		logger:error(string.format("The Prefix \\"%s\\" is not a valid Identifier in %s", self.VarNamePrefix, self.LuaVersion));
	end

	local globalScope = ast.globalScope;
	globalScope:renameVariables({
		Keywords = self.conventions.Keywords;
		generateName = generatorFunction;
		prefix = self.VarNamePrefix;
	});

	local timeDiff = gettime() - startTime;
	logger:info(string.format("Renaming Done in %.2f seconds", timeDiff));
end

return Pipeline;
`,"prometheus.randomLiterals":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- randomLiterals.lua
--
-- This Script provides a library for creating random literals

local Ast = require("prometheus.ast");
local RandomStrings = require("prometheus.randomStrings");

local RandomLiterals = {};

local function callNameGenerator(generatorFunction, ...)
	if(type(generatorFunction) == "table") then
		generatorFunction = generatorFunction.generateName;
	end
	return generatorFunction(...);
end

function RandomLiterals.String(pipeline)
    return Ast.StringExpression(callNameGenerator(pipeline.namegenerator, math.random(1, 4096)));
end

function RandomLiterals.Dictionary()
    return RandomStrings.randomStringNode(true);
end

function RandomLiterals.Number()
    return Ast.NumberExpression(math.random(-8388608, 8388607));
end

function RandomLiterals.Any(pipeline)
    local type = math.random(1, 3);
    if type == 1 then
        return RandomLiterals.String(pipeline);
    elseif type == 2 then
        return RandomLiterals.Number();
    elseif type == 3 then
        return RandomLiterals.Dictionary();
    end
end


return RandomLiterals;`,"prometheus.randomStrings":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- randomStrings.lua
--
-- This Script provides a library for generating random strings

local Ast = require("prometheus.ast")
local utils = require("prometheus.util")
local charset = utils.chararray("qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890")

local function randomString(wordsOrLen)
	if type(wordsOrLen) == "table" then
		return wordsOrLen[math.random(1, #wordsOrLen)];
	end

	wordsOrLen = wordsOrLen or math.random(2, 15);
	if wordsOrLen > 0 then
		return randomString(wordsOrLen - 1) .. charset[math.random(1, #charset)]
	else
		return ""
	end
end

local function randomStringNode(wordsOrLen)
	return Ast.StringExpression(randomString(wordsOrLen))
end

return {
	randomString = randomString,
	randomStringNode = randomStringNode,
}
`,"prometheus.scope":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- scope.lua
--
-- This Script provides a class for the Scope of a Lua Script

local logger = require("logger");
local config = require("config");

local Scope = {};

local scopeI = 0;
local function nextName()
	scopeI = scopeI + 1;
	return "local_scope_" .. tostring(scopeI);
end

local function generateWarning(token, message)
	return "Warning at Position " .. tostring(token.line) .. ":" .. tostring(token.linePos) .. ", " .. message;
end

-- Create a new Local Scope
function Scope:new(parentScope, name)
	local scope = {
		isGlobal = false,
		parentScope = parentScope,
		variables = {},
		referenceCounts = {};
		variablesLookup = {},
		variablesFromHigherScopes = {},
		skipIdLookup = {};
		name = name or nextName(),
		children = {},
		level = parentScope.level and (parentScope.level + 1) or 1;
	}

	setmetatable(scope, self);
	self.__index = self;
	parentScope:addChild(scope);
	return scope;
end

-- Create a new Global Scope
function Scope:newGlobal()
	local scope = {
		isGlobal = true,
		parentScope = nil,
		variables = {},
		variablesLookup = {};
		referenceCounts = {};
		skipIdLookup = {};
		name = "global_scope",
		children = {},
		level = 0,
	};

	setmetatable(scope, self);
	self.__index = self;

	return scope;
end

-- Returns the Parent Scope
function Scope:getParent(parentScope)
	return self.parentScope;
end

function Scope:setParent(parentScope)
	self.parentScope:removeChild(self);
	parentScope:addChild(self);
	self.parentScope = parentScope;
	self.level = parentScope.level + 1;
end

local next_name_i = 1;
-- Adds a Variable to the scope and returns the variable id, if no name is passed then a name is generated
function Scope:addVariable(name, token)
	if (not name) then
		name = string.format("%s%i", config.IdentPrefix, next_name_i);
		next_name_i = next_name_i + 1;
	end

	if self.variablesLookup[name] ~= nil then
		if(token) then
			logger:warn(generateWarning(token, "the variable \\"" .. name .. "\\" is already defined in that scope"));
		else
			logger:error(string.format("A variable with the name \\"%s\\" was already defined, you should have no variables starting with \\"%s\\"", name, config.IdentPrefix));
		end

		--return self.variablesLookup[name];
	end

	table.insert(self.variables, name);
	local id = #self.variables;
	self.variablesLookup[name] = id;
	return id;
end

function Scope:enableVariable(id)
	local name = self.variables[id];
	self.variablesLookup[name] = id;
end

function Scope:addDisabledVariable(name, token)
	if (not name) then
		name = string.format("%s%i", config.IdentPrefix, next_name_i);
		next_name_i = next_name_i + 1;
	end

	if self.variablesLookup[name] ~= nil then
		if(token) then
			logger:warn(generateWarning(token, "the variable \\"" .. name .. "\\" is already defined in that scope"));
		else
			logger:warn(string.format("a variable with the name \\"%s\\" was already defined", name));
		end

		--return self.variablesLookup[name];
	end

	table.insert(self.variables, name);
	local id = #self.variables;
	return id;
end

function Scope:addIfNotExists(id)
	if(not self.variables[id]) then
		local name = string.format("%s%i", config.IdentPrefix, next_name_i);
		next_name_i = next_name_i + 1;
		self.variables[id] = name;
		self.variablesLookup[name] = id;
	end
	return id;
end

-- Returns wether the variable is defined in this Scope
function Scope:hasVariable(name)
	if(self.isGlobal) then
		if self.variablesLookup[name] == nil then
			self:addVariable(name);
		end
		return true;
	end
	return self.variablesLookup[name] ~= nil;
end

-- Get List of all Variables defined in this Scope
function Scope:getVariables()
	return self.variables;
end

function Scope:resetReferences(id)
	self.referenceCounts[id] = 0;
end

function Scope:getReferences(id)
	return self.referenceCounts[id] or 0;
end

function Scope:removeReference(id)
	self.referenceCounts[id] = (self.referenceCounts[id] or 0) - 1;
end

function Scope:addReference(id)
	self.referenceCounts[id] = (self.referenceCounts[id] or 0) + 1;
end

-- Resolve the scope of a variable by name
function Scope:resolve(name)
	if(self:hasVariable(name)) then
		return self, self.variablesLookup[name];
	end
	assert(self.parentScope, "No Global Variable Scope was Created! This should not be Possible!");
	local scope, id = self.parentScope:resolve(name);
	self:addReferenceToHigherScope(scope, id, nil, true);
	return scope, id;
end

function Scope:resolveGlobal(name)
	if(self.isGlobal and self:hasVariable(name)) then
		return self, self.variablesLookup[name];
	end
	assert(self.parentScope, "No Global Variable Scope was Created! This should not be Possible!");
	local scope, id = self.parentScope:resolveGlobal(name);
	self:addReferenceToHigherScope(scope, id, nil, true);
	return scope, id;
end

-- Returns the name of an Variable by id - this is used for unparsing
function Scope:getVariableName(id)
	return self.variables[id];
end

-- Remove A Variable from this Scope
function Scope:removeVariable(id)
	local name = self.variables[id];
	self.variables[id] = nil;
	self.variablesLookup[name] = nil;
	self.skipIdLookup[id] = true;
end

-- Add a Children Scope
function Scope:addChild(scope)
	-- This will add all References from that Scope to higher Scopes. Note that the higher scopes may only be global
	for scope, ids in pairs(scope.variablesFromHigherScopes) do
		for id, count in pairs(ids) do
			if count and count > 0 then
				self:addReferenceToHigherScope(scope, id, count);
			end
		end
	end
	table.insert(self.children, scope);
end

function Scope:clearReferences()
	self.referenceCounts = {};
	self.variablesFromHigherScopes = {};
end

function Scope:removeChild(child)
	for i, v in ipairs(self.children) do
		if(v == child) then
			-- This will add all References from that Scope to higher Scopes. Note that the higher scopes may only be global
			for scope, ids in pairs(v.variablesFromHigherScopes) do
				for id, count in pairs(ids) do
					if count and count > 0 then
						self:removeReferenceToHigherScope(scope, id, count);
					end
				end
			end
			return table.remove(self.children, i);
		end
	end
end

function Scope:getMaxId()
	return #self.variables;
end

function Scope:addReferenceToHigherScope(scope, id, n, b)
	n = n or 1;
	if self.isGlobal then
		if not scope.isGlobal then
			logger:error(string.format("Could not resolve Scope \\"%s\\"", scope.name))
		end
		return
	end
	if scope == self then
		self.referenceCounts[id] = (self.referenceCounts[id] or 0) + n;
		return
	end
	if not self.variablesFromHigherScopes[scope] then
		self.variablesFromHigherScopes[scope] = {};
	end
	local scopeReferences = self.variablesFromHigherScopes[scope];
	if scopeReferences[id] then
		scopeReferences[id] = scopeReferences[id] + n;
	else
		scopeReferences[id] = n;
	end
	if not b then
		self.parentScope:addReferenceToHigherScope(scope, id, n);
	end
end

function Scope:removeReferenceToHigherScope(scope, id, n, b)
	n = n or 1;
	if self.isGlobal then
		return
	end
	if scope == self then
		self.referenceCounts[id] = (self.referenceCounts[id] or 0) - n;
		return
	end
	if not self.variablesFromHigherScopes[scope] then
		self.variablesFromHigherScopes[scope] = {};
	end
	local scopeReferences = self.variablesFromHigherScopes[scope];
	if scopeReferences[id] then
		scopeReferences[id] = scopeReferences[id] - n;
	else
		scopeReferences[id] = 0;
	end
	if not b then
		self.parentScope:removeReferenceToHigherScope(scope, id, n);
	end
end

-- Rename Variables from that scope downwards
-- this function needs a settings object with the following properties
-- Keywords => forbidden Variable Names
-- generateName(id, scope, originalName) => function to generate unique variable name based on the id and scope
function Scope:renameVariables(settings)
	if(not self.isGlobal) then
		local prefix = settings.prefix or "";
		local forbiddenNamesLookup = {};
		for _, keyword in pairs(settings.Keywords) do
			forbiddenNamesLookup[keyword] = true;
		end

		for scope, ids in pairs(self.variablesFromHigherScopes) do
			for id, count in pairs(ids) do
				if count and count > 0 then
					local name = scope:getVariableName(id);
					forbiddenNamesLookup[name] = true;
				end
			end
		end

		self.variablesLookup = {};

		local i = 0;
		for id, originalName in pairs(self.variables) do
			if(not self.skipIdLookup[id] and (self.referenceCounts[id] or 0) >= 0) then
				local name;
				repeat
					name = prefix .. settings.generateName(i, self, originalName);
					if name == nil then
						name = originalName;
					end
					i = i + 1;
				until not forbiddenNamesLookup[name];

				self.variables[id] = name;
				self.variablesLookup[name] = id;
			end
		end
	end

	for _, scope in pairs(self.children) do
		scope:renameVariables(settings);
	end
end

return Scope;`,"prometheus.step":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- step.lua
--
-- This Script provides the base class for Obfuscation Steps

local logger = require("logger");
local util = require("prometheus.util");

local lookupify = util.lookupify;

local Step = {};

Step.SettingsDescriptor = {}

function Step:new(settings)
	local instance = {};
	setmetatable(instance, self);
	self.__index = self;

	if type(settings) ~= "table" then
		settings = {};
	end

	for key, data in pairs(self.SettingsDescriptor) do
		local settingValue = settings[key];
		if settingValue == nil and type(data.aliases) == "table" then
			for _, alias in ipairs(data.aliases) do
				if settings[alias] ~= nil then
					settingValue = settings[alias];
					break;
				end
			end
		end

		if settingValue == nil then
			if data.default == nil then
				logger:error(string.format("The Setting \\"%s\\" was not provided for the Step \\"%s\\"", key, self.Name));
			end
			instance[key] = data.default;
		elseif(data.type == "enum") then
			local lookup = lookupify(data.values);
			if not lookup[settingValue] then
				logger:error(string.format("Invalid value for the Setting \\"%s\\" of the Step \\"%s\\". It must be one of the following: %s", key, self.Name, table.concat(data, ", ")));
			end
			instance[key] = settingValue;
		elseif(type(settingValue) ~= data.type) then
			logger:error(string.format("Invalid value for the Setting \\"%s\\" of the Step \\"%s\\". It must be a %s", key, self.Name, data.type));
		else
			if data.min then
				if  settingValue < data.min then
					logger:error(string.format("Invalid value for the Setting \\"%s\\" of the Step \\"%s\\". It must be at least %d", key, self.Name, data.min));
				end
			end

			if data.max then
				if  settingValue > data.max then
					logger:error(string.format("Invalid value for the Setting \\"%s\\" of the Step \\"%s\\". The biggest allowed value is %d", key, self.Name, data.max));
				end
			end

			instance[key] = settingValue;
		end
	end

	instance:init();

	return instance;
end

function Step:init()
	logger:error("Abstract Steps cannot be Created");
end

function Step:extend()
	local ext = {};
	setmetatable(ext, self);
	self.__index = self;
	return ext;
end

function Step:apply(ast, pipeline)
	logger:error("Abstract Steps cannot be Applied")
end

Step.Name = "Abstract Step";
Step.Description = "Abstract Step";

return Step;
`,"prometheus.steps.AddVararg":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- AddVararg.lua
--
-- This Script provides a Simple Obfuscation Step that wraps the entire Script into a function

local Step = require("prometheus.step");
local Ast = require("prometheus.ast");
local visitast = require("prometheus.visitast");
local AstKind = Ast.AstKind;

local AddVararg = Step:extend();
AddVararg.Description = "This Step Adds Vararg to all Functions";
AddVararg.Name = "Add Vararg";

AddVararg.SettingsDescriptor = {}

function AddVararg:init(_) end

function AddVararg:apply(ast)
	visitast(ast, nil, function(node)
        if node.kind == AstKind.FunctionDeclaration or node.kind == AstKind.LocalFunctionDeclaration or node.kind == AstKind.FunctionLiteralExpression then
            if #node.args < 1 or node.args[#node.args].kind ~= AstKind.VarargExpression then
                node.args[#node.args + 1] = Ast.VarargExpression();
            end
        end
    end)
end

return AddVararg;`,"prometheus.steps.AntiTamper":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- AntiTamper.lua
--
-- This Script provides an Obfuscation Step, that breaks the script, when someone tries to tamper with it.

local Step = require("prometheus.step")
local RandomStrings = require("prometheus.randomStrings")
local Parser = require("prometheus.parser")
local Enums = require("prometheus.enums")
local logger = require("logger")

local AntiTamper = Step:extend()
AntiTamper.Description = "This Step Breaks your Script when it is modified. This is only effective when using the new VM."
AntiTamper.Name = "Anti Tamper"

AntiTamper.SettingsDescriptor = {
	UseDebug = {
		type = "boolean",
		default = true,
		description = "Use debug library. (Recommended, however scripts will not work without debug library.)",
	},
}

local function generateSanityCheck()
	local sanityCheckAnswers = {}
	local sanityPasses = math.random(1, 10)
	for i = 1, sanityPasses do
		sanityCheckAnswers[i] = (math.random(1, 2 ^ 24) % 2 == 1)
	end
	local primaryCheck = RandomStrings.randomString()
	local codeParts = {}
	local function addCode(fmt, ...)
		table.insert(codeParts, string.format(fmt, ...))
	end

	local function generateAssignment(idx)
		local index = math.min(idx, sanityPasses)
		addCode("            valid = %s;\\n", tostring(sanityCheckAnswers[index]))
	end
	local function generateValidation(idx)
		local index = math.min(idx - 1, sanityPasses)
		addCode("            if valid == %s then\\n", tostring(sanityCheckAnswers[index]))
		addCode("            else\\n")
		addCode("                while true do end\\n")
		addCode("            end\\n")
	end

	addCode("do local valid = '%s';", primaryCheck)
	addCode("for i = 0, %d do\\n", sanityPasses)
	for i = 0, sanityPasses do
		if i == 0 then
			addCode("        if i == 0 then\\n")
			addCode("            if valid ~= '%s' then\\n", primaryCheck)
			addCode("                while true do end\\n")
			addCode("            end\\n")
			addCode("            valid = %s;\\n", tostring(sanityCheckAnswers[1]))
		elseif i == 1 then
			addCode("        elseif i == 1 then\\n")
			addCode("            if valid == %s then\\n", tostring(sanityCheckAnswers[1]))
			addCode("            end\\n")
		else
			addCode("        elseif i == %d then\\n", i)

			--[[
                Basically, even iterations are used to assign a new sanity check value,
                and odd iterations are used to validate the previous sanity check value.
            ]]
			if i % 2 == 0 then
				generateAssignment(i)
			else
				generateValidation(i)
			end
		end
	end
	addCode("        end\\n")
	addCode("    end\\n")
	addCode("do valid = true end\\n")
	return table.concat(codeParts)
end

function AntiTamper:init(settings) end

function AntiTamper:apply(ast, pipeline)
	if pipeline.PrettyPrint then
		logger:warn(string.format('"%s" cannot be used with PrettyPrint, ignoring "%s"', self.Name, self.Name))
		return ast
	end
	local code = generateSanityCheck()
	if self.UseDebug then
		local string = RandomStrings.randomString()
		code = code
			.. [[
            -- Anti Beautify
			local sethook = debug and debug.sethook or function() end;
			local allowedLine = nil;
			local called = 0;
			sethook(function(s, line)
				if not line then
					return
				end
				called = called + 1;
				if allowedLine then
					if allowedLine ~= line then
						sethook(error, "l", 5);
					end
				else
					allowedLine = line;
				end
			end, "l", 5);
			(function() end)();
			(function() end)();
			sethook();
			if called < 2 then
				valid = false;
			end
            if called < 2 then
                valid = false;
            end

            -- Anti Function Hook
            local funcs = {pcall, string.char, debug.getinfo, string.dump}
            for i = 1, #funcs do
                if debug.getinfo(funcs[i]).what ~= "C" then
                    valid = false;
                end

                if debug.getupvalue(funcs[i], 1) then
                    valid = false;
                end

                if pcall(string.dump, funcs[i]) then
                    valid = false;
                end
            end

            -- Anti Beautify
            local function getTraceback()
                local str = (function(arg)
                    return debug.traceback(arg)
                end)("]] .. string .. [[");
                return str;
            end

            local traceback = getTraceback();
            valid = valid and traceback:sub(1, traceback:find("\\n") - 1) == "]] .. string .. [[";
            local iter = traceback:gmatch(":(%d*):");
            local v, c = iter(), 1;
            for i in iter do
                valid = valid and i == v;
                c = c + 1;
            end
            valid = valid and c >= 2;
        ]]
    end
    code = code .. [[
    local gmatch = string.gmatch;
    local err = function() error("Tamper Detected!") end;

    local pcallIntact2 = false;
    local pcallIntact = pcall(function()
        pcallIntact2 = true;
    end) and pcallIntact2;

    local random = math.random;
    local tblconcat = table.concat;
    local unpkg = table and table.unpack or unpack;
    local n = random(3, 65);
    local acc1 = 0;
    local acc2 = 0;
    local pcallRet = {pcall(function() local a = ]] .. tostring(math.random(1, 2^24)) .. [[ - "]] .. RandomStrings.randomString() .. [[" ^ ]] .. tostring(math.random(1, 2^24)) .. [[ return "]] .. RandomStrings.randomString() .. [[" / a; end)};
    local origMsg = pcallRet[2];
    local line = tonumber(gmatch(tostring(origMsg), ':(%d*):')());
    for i = 1, n do
        local len = math.random(1, 100);
        local n2 = random(0, 255);
        local pos = random(1, len);
        local shouldErr = random(1, 2) == 1;
        local msg = origMsg:gsub(':(%d*):', ':' .. tostring(random(0, 10000)) .. ':');
        local arr = {pcall(function()
            if random(1, 2) == 1 or i == n then
                local line2 = tonumber(gmatch(tostring(({pcall(function() local a = ]] .. tostring(math.random(1, 2^24)) .. [[ - "]] .. RandomStrings.randomString() .. [[" ^ ]] .. tostring(math.random(1, 2^24)) .. [[ return "]] .. RandomStrings.randomString() .. [[" / a; end)})[2]), ':(%d*):')());
                valid = valid and line == line2;
            end
            if shouldErr then
                error(msg, 0);
            end
            local arr = {};
            for i = 1, len do
                arr[i] = random(0, 255);
            end
            arr[pos] = n2;
            return unpkg(arr);
        end)};
        if shouldErr then
            valid = valid and arr[1] == false and arr[2] == msg;
        else
            valid = valid and arr[1];
            acc1 = (acc1 + arr[pos + 1]) % 256;
            acc2 = (acc2 + n2) % 256;
        end
    end
    valid = valid and acc1 == acc2;

    if valid then else
        repeat
            return (function()
                while true do
                    l1, l2 = l2, l1;
                    err();
                end
            end)();
        until true;
        while true do
            l2 = random(1, 6);
            if l2 > 2 then
                l2 = tostring(l1);
            else
                l1 = l2;
            end
        end
        return;
    end
end

    -- Anti Function Arg Hook
    local obj = setmetatable({}, {
        __tostring = err,
    });
    obj[math.random(1, 100)] = obj;
    (function() end)(obj);

    repeat until valid;
    ]]

    local parsed = Parser:new({LuaVersion = Enums.LuaVersion.Lua51}):parse(code);
    local doStat = parsed.body.statements[1];
    doStat.body.scope:setParent(ast.body.scope);
    table.insert(ast.body.statements, 1, doStat);

    return ast;
end

return AntiTamper;
`,"prometheus.steps.ConstantArray":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- ConstantArray.lua
--
-- This Script provides a Simple Obfuscation Step that wraps the entire Script into a function

-- TODO: Wrapper Functions
-- TODO: Proxy Object for indexing: e.g: ARR[X] becomes ARR + X

local Step = require("prometheus.step");
local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");
local visitast = require("prometheus.visitast");
local util = require("prometheus.util")
local Parser = require("prometheus.parser");
local enums = require("prometheus.enums")

local LuaVersion = enums.LuaVersion;
local AstKind = Ast.AstKind;

local ConstantArray = Step:extend();
ConstantArray.Description = "This Step will Extract all Constants and put them into an Array at the beginning of the script";
ConstantArray.Name = "Constant Array";

ConstantArray.SettingsDescriptor = {
	Threshold = {
		name = "Threshold",
		description = "The relative amount of nodes that will be affected",
		type = "number",
		default = 1,
		min = 0,
		max = 1,
		aliases = { "Treshold" },
	},
	StringsOnly = {
		name = "StringsOnly",
		description = "Wether to only Extract Strings",
		type = "boolean",
		default = false,
	},
	Shuffle = {
		name = "Shuffle",
		description = "Wether to shuffle the order of Elements in the Array",
		type = "boolean",
		default = true,
	},
	Rotate = {
		name = "Rotate",
		description = "Wether to rotate the String Array by a specific (random) amount. This will be undone on runtime.",
		type = "boolean",
		default = true,
	},
	LocalWrapperThreshold = {
		name = "LocalWrapperThreshold",
		description = "The relative amount of nodes functions, that will get local wrappers",
		type = "number",
		default = 1,
		min = 0,
		max = 1,
		aliases = { "LocalWrapperTreshold" },
	},
	LocalWrapperCount = {
		name = "LocalWrapperCount",
		description = "The number of Local wrapper Functions per scope. This only applies if LocalWrapperThreshold is greater than 0",
		type = "number",
		min = 0,
		max = 512,
		default = 0,
	},
	LocalWrapperArgCount = {
		name = "LocalWrapperArgCount",
		description = "The number of Arguments to the Local wrapper Functions",
		type = "number",
		min = 1,
		default = 10,
		max = 200,
	};
	MaxWrapperOffset = {
		name = "MaxWrapperOffset",
		description = "The Max Offset for the Wrapper Functions",
		type = "number",
		min = 0,
		default = 65535,
	};
	Encoding = {
		name = "Encoding",
		description = "The Encoding to use for the Strings",
		type = "enum",
		default = "mixed",
		values = {
			"none",
			"base64",
			"base85",
			"mixed",
		},
	}
}

local prefix_0, prefix_1;
local function initPrefixes()
	local charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@£$%^&*()_+-=[]{}|:;<>,./?";
	repeat
		local a, b = math.random(1, #charset), math.random(1, #charset);
		prefix_0 = charset:sub(a, a);
		prefix_1 = charset:sub(b, b);
	until prefix_0 ~= prefix_1
end

local function callNameGenerator(generatorFunction, ...)
	if(type(generatorFunction) == "table") then
		generatorFunction = generatorFunction.generateName;
	end
	return generatorFunction(...);
end

function ConstantArray:init(_) end

function ConstantArray:createArray()
	local entries = {};
	for i, v in ipairs(self.constants) do
		if type(v) == "string" then
			v = self:encode(v);
		end
		entries[i] = Ast.TableEntry(Ast.ConstantNode(v));
	end
	return Ast.TableConstructorExpression(entries);
end

function ConstantArray:indexing(index, data)
	if self.LocalWrapperCount > 0 and data.functionData.local_wrappers then
		local wrappers = data.functionData.local_wrappers;
		local wrapper = wrappers[math.random(#wrappers)];

		local args = {};
		local ofs = index - self.wrapperOffset - wrapper.offset;
		for i = 1, self.LocalWrapperArgCount, 1 do
			if i == wrapper.arg then
				args[i] = Ast.NumberExpression(ofs);
			else
				args[i] = Ast.NumberExpression(math.random(ofs - 1024, ofs + 1024));
			end
		end

		data.scope:addReferenceToHigherScope(wrappers.scope, wrappers.id);
		return Ast.FunctionCallExpression(Ast.IndexExpression(
			Ast.VariableExpression(wrappers.scope, wrappers.id),
			Ast.StringExpression(wrapper.index)
		), args);
	else
		data.scope:addReferenceToHigherScope(self.rootScope, self.wrapperId);
		return Ast.FunctionCallExpression(Ast.VariableExpression(self.rootScope, self.wrapperId), {
			Ast.NumberExpression(index - self.wrapperOffset);
		});
	end
end

function ConstantArray:getConstant(value, data)
	if(self.lookup[value]) then
		return self:indexing(self.lookup[value], data)
	end
	local idx = #self.constants + 1;
	self.constants[idx] = value;
	self.lookup[value] = idx;
	return self:indexing(idx, data);
end

function ConstantArray:addConstant(value)
	if(self.lookup[value]) then
		return
	end
	local idx = #self.constants + 1;
	self.constants[idx] = value;
	self.lookup[value] = idx;
end

local function reverse(t, i, j)
	while i < j do
	  t[i], t[j] = t[j], t[i]
	  i, j = i+1, j-1
	end
end

local function rotate(t, d, n)
	n = n or #t
	d = (d or 1) % n
	reverse(t, 1, n)
	reverse(t, 1, d)
	reverse(t, d+1, n)
end

local rotateCode = [=[
	for i, v in ipairs({{1, LEN}, {1, SHIFT}, {SHIFT + 1, LEN}}) do
		while v[1] < v[2] do
			ARR[v[1]], ARR[v[2]], v[1], v[2] = ARR[v[2]], ARR[v[1]], v[1] + 1, v[2] - 1
		end
	end
]=];

function ConstantArray:addRotateCode(ast, shift)
	local parser = Parser:new({
		LuaVersion = LuaVersion.Lua51;
	});

	local newAst = parser:parse(string.gsub(string.gsub(rotateCode, "SHIFT", tostring(shift)), "LEN", tostring(#self.constants)));
	local forStat = newAst.body.statements[1];
	forStat.body.scope:setParent(ast.body.scope);
	visitast(newAst, nil, function(node, data)
		if(node.kind == AstKind.VariableExpression) then
			if(node.scope:getVariableName(node.id) == "ARR") then
				data.scope:removeReferenceToHigherScope(node.scope, node.id);
				data.scope:addReferenceToHigherScope(self.rootScope, self.arrId);
				node.scope = self.rootScope;
				node.id = self.arrId;
			end
		end
	end)

	table.insert(ast.body.statements, 1, forStat);
end

function ConstantArray:addDecodeCode(ast)
	if self.Encoding == "base64" then
		local base64DecodeCode = [[
	do ]] .. table.concat(util.shuffle{
		"local lookup = LOOKUP_TABLE;",
		"local len = string.len;",
		"local sub = string.sub;",
		"local floor = math.floor;",
		"local strchar = string.char;",
		"local insert = table.insert;",
		"local concat = table.concat;",
		"local type = type;",
		"local arr = ARR;",
	}) .. [[
		for i = 1, #arr do
			local data = arr[i];
			if type(data) == "string" then
				local length = len(data)
				local parts = {}
				local index = 1
				local value = 0
				local count = 0
				while index <= length do
					local char = sub(data, index, index)
					local code = lookup[char]
					if code then
						value = value + code * (64 ^ (3 - count))
						count = count + 1
						if count == 4 then
							count = 0
							local c1 = floor(value / 65536)
							local c2 = floor(value % 65536 / 256)
							local c3 = value % 256
							insert(parts, strchar(c1, c2, c3))
							value = 0
						end
					elseif char == "=" then
						insert(parts, strchar(floor(value / 65536)));
						if index >= length or sub(data, index + 1, index + 1) ~= "=" then
							insert(parts, strchar(floor(value % 65536 / 256)));
						end
						break
					end
					index = index + 1
				end
				arr[i] = concat(parts)
			end
		end
	end
]];

		local parser = Parser:new({
			LuaVersion = LuaVersion.Lua51;
		});

		local newAst = parser:parse(base64DecodeCode);
		local forStat = newAst.body.statements[1];
		forStat.body.scope:setParent(ast.body.scope);

		visitast(newAst, nil, function(node, data)
			if(node.kind == AstKind.VariableExpression) then
				if(node.scope:getVariableName(node.id) == "ARR") then
					data.scope:removeReferenceToHigherScope(node.scope, node.id);
					data.scope:addReferenceToHigherScope(self.rootScope, self.arrId);
					node.scope = self.rootScope;
					node.id = self.arrId;
				end

				if(node.scope:getVariableName(node.id) == "LOOKUP_TABLE") then
					data.scope:removeReferenceToHigherScope(node.scope, node.id);
					return self:createBase64Lookup();
				end
			end
		end)

		table.insert(ast.body.statements, 1, forStat);
	elseif self.Encoding == "base85" then
		local base85DecodeCode = [[
	do ]] .. table.concat(util.shuffle{
		"local lookup = LOOKUP_TABLE;",
		"local len = string.len;",
		"local sub = string.sub;",
		"local floor = math.floor;",
		"local strchar = string.char;",
		"local insert = table.insert;",
		"local concat = table.concat;",
		"local type = type;",
		"local arr = ARR;",
	}) .. [[
		for i = 1, #arr do
			local data = arr[i];
			if type(data) == "string" then
				local length = len(data)
				local parts = {}
				local index = 1
				while index <= length do
					local remain = length - index + 1
					local count = remain >= 5 and 5 or remain
					local value = 0
					local valid = count > 1

					for j = 0, 4 do
						local code
						if j < count then
							local ch = sub(data, index + j, index + j)
							code = lookup[ch]
							if not code then
								valid = false
								break
							end
						else
							code = 84
						end
						value = value * 85 + code
					end

					if valid then
						local b1 = floor(value / 16777216) % 256
						local b2 = floor(value / 65536) % 256
						local b3 = floor(value / 256) % 256
						local b4 = value % 256
						if count == 5 then
							insert(parts, strchar(b1, b2, b3, b4))
						elseif count == 4 then
							insert(parts, strchar(b1, b2, b3))
						elseif count == 3 then
							insert(parts, strchar(b1, b2))
						elseif count == 2 then
							insert(parts, strchar(b1))
						end
					end

					index = index + count
				end
				arr[i] = concat(parts)
			end
		end
	end
]];

		local parser = Parser:new({
			LuaVersion = LuaVersion.Lua51;
		});

		local newAst = parser:parse(base85DecodeCode);
		local forStat = newAst.body.statements[1];
		forStat.body.scope:setParent(ast.body.scope);

		visitast(newAst, nil, function(node, data)
			if(node.kind == AstKind.VariableExpression) then
				if(node.scope:getVariableName(node.id) == "ARR") then
					data.scope:removeReferenceToHigherScope(node.scope, node.id);
					data.scope:addReferenceToHigherScope(self.rootScope, self.arrId);
					node.scope = self.rootScope;
					node.id = self.arrId;
				end

				if(node.scope:getVariableName(node.id) == "LOOKUP_TABLE") then
					data.scope:removeReferenceToHigherScope(node.scope, node.id);
					return self:createBase85Lookup();
				end
			end
		end)

		table.insert(ast.body.statements, 1, forStat);
	elseif self.Encoding == "mixed" then
		local mixedDecodeCode = [[
	do ]] .. table.concat(util.shuffle{
		"local lookup64 = LOOKUP_TABLE_64;",
		"local lookup85 = LOOKUP_TABLE_85;",
		"local len = string.len;",
		"local sub = string.sub;",
		"local floor = math.floor;",
		"local strchar = string.char;",
		"local insert = table.insert;",
		"local concat = table.concat;",
		"local type = type;",
		"local arr = ARR;",
	}) .. [[
		for i = 1, #arr do
			local data = arr[i];
			if type(data) == "string" then
				local first = sub(data, 1, 1)
				if first == "]]..prefix_0..[[" then
					data = sub(data, 2)
					local length = len(data)
					local parts = {}
					local index = 1
					local value = 0
					local count = 0
					while index <= length do
						local char = sub(data, index, index)
						local code = lookup64[char]
						if code then
							value = value + code * (64 ^ (3 - count))
							count = count + 1
							if count == 4 then
								count = 0
								local c1 = floor(value / 65536)
								local c2 = floor(value % 65536 / 256)
								local c3 = value % 256
								insert(parts, strchar(c1, c2, c3))
								value = 0
							end
						elseif char == "=" then
							insert(parts, strchar(floor(value / 65536)));
							if index >= length or sub(data, index + 1, index + 1) ~= "=" then
								insert(parts, strchar(floor(value % 65536 / 256)));
							end
							break
						end
						index = index + 1
					end
					arr[i] = concat(parts)
				elseif first == "]]..prefix_1..[[" then
					data = sub(data, 2)
					local length = len(data)
					local parts = {}
					local idx = 1
					while idx <= length do
						local remain = length - idx + 1
						local count = remain >= 5 and 5 or remain
						local value = 0
						local valid = count > 1

						for j = 0, 4 do
							local code
							if j < count then
								local ch = sub(data, idx + j, idx + j)
								code = lookup85[ch]
								if not code then
									valid = false
									break
								end
							else
								code = 84
							end
							value = value * 85 + code
						end

						if valid then
							local b1 = floor(value / 16777216) % 256
							local b2 = floor(value / 65536) % 256
							local b3 = floor(value / 256) % 256
							local b4 = value % 256
							if count == 5 then
								insert(parts, strchar(b1, b2, b3, b4))
							elseif count == 4 then
								insert(parts, strchar(b1, b2, b3))
							elseif count == 3 then
								insert(parts, strchar(b1, b2))
							elseif count == 2 then
								insert(parts, strchar(b1))
							end
						end

						idx = idx + count
					end
					arr[i] = concat(parts)
				end
			end
		end
	end
]];

		local parser = Parser:new({
			LuaVersion = LuaVersion.Lua51;
		});

		local newAst = parser:parse(mixedDecodeCode);
		local forStat = newAst.body.statements[1];
		forStat.body.scope:setParent(ast.body.scope);

		visitast(newAst, nil, function(node, data)
			if(node.kind == AstKind.VariableExpression) then
				if(node.scope:getVariableName(node.id) == "ARR") then
					data.scope:removeReferenceToHigherScope(node.scope, node.id);
					data.scope:addReferenceToHigherScope(self.rootScope, self.arrId);
					node.scope = self.rootScope;
					node.id = self.arrId;
				end

				if(node.scope:getVariableName(node.id) == "LOOKUP_TABLE_64") then
					data.scope:removeReferenceToHigherScope(node.scope, node.id);
					return self:createBase64Lookup();
				end

				if(node.scope:getVariableName(node.id) == "LOOKUP_TABLE_85") then
					data.scope:removeReferenceToHigherScope(node.scope, node.id);
					return self:createBase85Lookup();
				end
			end
		end)

		table.insert(ast.body.statements, 1, forStat);
	end
end

function ConstantArray:createBase64Lookup()
	local entries = {};
	local i = 0;
	for char in string.gmatch(self.base64chars, ".") do
		table.insert(entries, Ast.KeyedTableEntry(Ast.StringExpression(char), Ast.NumberExpression(i)));
		i = i + 1;
	end
	util.shuffle(entries);
	return Ast.TableConstructorExpression(entries);
end

function ConstantArray:createBase85Lookup()
	local entries = {};
	local i = 0;
	for char in string.gmatch(self.base85chars, ".") do
		table.insert(entries, Ast.KeyedTableEntry(Ast.StringExpression(char), Ast.NumberExpression(i)));
		i = i + 1;
	end
	util.shuffle(entries);
	return Ast.TableConstructorExpression(entries);
end

function ConstantArray:encode(str)
	if self.Encoding == "base64" then
		return ((str:gsub('.', function(x)
			local r,b='',x:byte()
			for i=8,1,-1 do r=r..(b%2^i-b%2^(i-1)>0 and '1' or '0') end
			return r;
		end)..'0000'):gsub('%d%d%d?%d?%d?%d?', function(x)
			if (#x < 6) then return '' end
			local c=0
			for i=1,6 do c=c+(x:sub(i,i)=='1' and 2^(6-i) or 0) end
			return self.base64chars:sub(c+1,c+1)
		end)..({ '', '==', '=' })[#str%3+1]);
	elseif self.Encoding == "base85" then
		local result = {};
		local len = #str;
		local pos = 1;

		while pos <= len do
			local rem = len - pos + 1;
			local count = rem >= 4 and 4 or rem;
			local b1, b2, b3, b4 = string.byte(str, pos, pos + count - 1);
			b1, b2, b3, b4 = b1 or 0, b2 or 0, b3 or 0, b4 or 0;

			local value = ((b1 * 256 + b2) * 256 + b3) * 256 + b4;
			local chars = {};
			for i = 5, 1, -1 do
				local code = (value % 85) + 1;
				chars[i] = self.base85chars:sub(code, code);
				value = math.floor(value / 85);
			end

			result[#result + 1] = table.concat(chars, "", 1, count + 1);
			pos = pos + count;
		end

		return table.concat(result);
	elseif self.Encoding == "mixed" then
		if math.random() < 0.5 then
			local encoded = ((str:gsub('.', function(x)
				local r,b='',x:byte()
				for i=8,1,-1 do r=r..(b%2^i-b%2^(i-1)>0 and '1' or '0') end
				return r;
			end)..'0000'):gsub('%d%d%d?%d?%d?%d?', function(x)
				if (#x < 6) then return '' end
				local c=0
				for i=1,6 do c=c+(x:sub(i,i)=='1' and 2^(6-i) or 0) end
				return self.base64chars:sub(c+1,c+1)
			end)..({ '', '==', '=' })[#str%3+1]);
			return prefix_0 .. encoded;
		else
			local result = {};
			local len = #str;
			local pos = 1;

			while pos <= len do
				local rem = len - pos + 1;
				local count = rem >= 4 and 4 or rem;
				local b1, b2, b3, b4 = string.byte(str, pos, pos + count - 1);
				b1 = b1 or 0;
				b2 = b2 or 0;
				b3 = b3 or 0;
				b4 = b4 or 0;

				local value = ((b1 * 256 + b2) * 256 + b3) * 256 + b4;
				local chars = {};
				for i = 5, 1, -1 do
					local code = (value % 85) + 1;
					chars[i] = self.base85chars:sub(code, code);
					value = math.floor(value / 85);
				end

				result[#result + 1] = table.concat(chars, "", 1, count + 1);
				pos = pos + count;
			end

			return prefix_1 .. table.concat(result);
		end
	end
end

function ConstantArray:apply(ast, pipeline)
	initPrefixes();
	self.rootScope = ast.body.scope;
	self.arrId = self.rootScope:addVariable();

	self.base64chars = table.concat(util.shuffle{
		"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
		"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
		"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
		"+", "/",
	});

	self.base85chars = table.concat(util.shuffle{
		"!", "\\"", "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
		"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
		":", ";", "<", "=", ">", "?", "@",
		"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
		"P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
		"[", "\\\\", "]", "^", "_", "\`",
		"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
		"p", "q", "r", "s", "t", "u",
	});

	self.constants = {};
	self.lookup = {};

	-- Extract Constants
	visitast(ast, nil, function(node, data)
		-- Apply only to some nodes
		if math.random() <= self.Threshold then
			node.__apply_constant_array = true;
			if node.kind == AstKind.StringExpression then
				self:addConstant(node.value);
			elseif not self.StringsOnly then
				if node.isConstant then
					if node.value ~= nil then
						self:addConstant(node.value);
					end
				end
			end
		end
	end);

	-- Shuffle Array
	if self.Shuffle then
		self.constants = util.shuffle(self.constants);
		self.lookup = {};
		for i, v in ipairs(self.constants) do
			self.lookup[v] = i;
		end
	end

	-- Set Wrapper Function Offset
	self.wrapperOffset = math.random(-self.MaxWrapperOffset, self.MaxWrapperOffset);
	self.wrapperId = self.rootScope:addVariable();

	visitast(ast, function(node, data)
		-- Add Local Wrapper Functions
		if self.LocalWrapperCount > 0 and node.kind == AstKind.Block and node.isFunctionBlock and math.random() <= self.LocalWrapperThreshold then
			local id = node.scope:addVariable()
			data.functionData.local_wrappers = {
				id = id;
				scope = node.scope,
			};
			local nameLookup = {};
			for i = 1, self.LocalWrapperCount, 1 do
				local name;
				repeat
					name = callNameGenerator(pipeline.namegenerator, math.random(1, self.LocalWrapperArgCount * 16));
				until not nameLookup[name];
				nameLookup[name] = true;

				local offset = math.random(-self.MaxWrapperOffset, self.MaxWrapperOffset);
				local argPos = math.random(1, self.LocalWrapperArgCount);

				data.functionData.local_wrappers[i] = {
					arg = argPos,
					index = name,
					offset =  offset,
				};
				data.functionData.__used = false;
			end
		end
		if node.__apply_constant_array then
			data.functionData.__used = true;
		end
	end, function(node, data)
		-- Actually insert Statements to get the Constant Values
		if node.__apply_constant_array then
			if node.kind == AstKind.StringExpression then
				return self:getConstant(node.value, data);
			elseif not self.StringsOnly then
				if node.isConstant then
					return node.value ~= nil and self:getConstant(node.value, data);
				end
			end
			node.__apply_constant_array = nil;
		end

		-- Insert Local Wrapper Declarations
		if self.LocalWrapperCount > 0 and node.kind == AstKind.Block and node.isFunctionBlock and data.functionData.local_wrappers and data.functionData.__used then
			data.functionData.__used = nil;
			local elems = {};
			local wrappers = data.functionData.local_wrappers;
			for i = 1, self.LocalWrapperCount, 1 do
				local wrapper = wrappers[i];
				local argPos = wrapper.arg;
				local offset = wrapper.offset;
				local name = wrapper.index;

				local funcScope = Scope:new(node.scope);

				local arg = nil;
				local args = {};

				for i = 1, self.LocalWrapperArgCount, 1 do
					args[i] = funcScope:addVariable();
					if i == argPos then
						arg = args[i];
					end
				end

				local addSubArg;

				-- Create add and Subtract code
				if offset < 0 then
					addSubArg = Ast.SubExpression(Ast.VariableExpression(funcScope, arg), Ast.NumberExpression(-offset));
				else
					addSubArg = Ast.AddExpression(Ast.VariableExpression(funcScope, arg), Ast.NumberExpression(offset));
				end

				funcScope:addReferenceToHigherScope(self.rootScope, self.wrapperId);
				local callArg = Ast.FunctionCallExpression(Ast.VariableExpression(self.rootScope, self.wrapperId), {
					addSubArg
				});

				local fargs = {};
				for i, v in ipairs(args) do
					fargs[i] = Ast.VariableExpression(funcScope, v);
				end

				elems[i] = Ast.KeyedTableEntry(
					Ast.StringExpression(name),
					Ast.FunctionLiteralExpression(fargs, Ast.Block({
						Ast.ReturnStatement({
							callArg
						});
					}, funcScope))
				)
			end
			table.insert(node.statements, 1, Ast.LocalVariableDeclaration(node.scope, {
				wrappers.id
			}, {
				Ast.TableConstructorExpression(elems)
			}));
		end
	end);

	self:addDecodeCode(ast);

	local steps = util.shuffle({
		-- Add Wrapper Function Code
		function()
			local funcScope = Scope:new(self.rootScope);
			-- Add Reference to Array
			funcScope:addReferenceToHigherScope(self.rootScope, self.arrId);

			local arg = funcScope:addVariable();
			local addSubArg;

			-- Create add and Subtract code
			if self.wrapperOffset < 0 then
				addSubArg = Ast.SubExpression(Ast.VariableExpression(funcScope, arg), Ast.NumberExpression(-self.wrapperOffset));
			else
				addSubArg = Ast.AddExpression(Ast.VariableExpression(funcScope, arg), Ast.NumberExpression(self.wrapperOffset));
			end

			-- Create and Add the Function Declaration
			table.insert(ast.body.statements, 1, Ast.LocalFunctionDeclaration(self.rootScope, self.wrapperId, {
				Ast.VariableExpression(funcScope, arg)
			}, Ast.Block({
				Ast.ReturnStatement({
					Ast.IndexExpression(
						Ast.VariableExpression(self.rootScope, self.arrId),
						addSubArg
					)
				});
			}, funcScope)));

			-- Resulting Code:
			-- function xy(a)
			-- 		return ARR[a - 10]
			-- end
		end,
		-- Rotate Array and Add unrotate code
		function()
			if self.Rotate and #self.constants > 1 then
				local shift = math.random(1, #self.constants - 1);

				rotate(self.constants, -shift);
				self:addRotateCode(ast, shift);
			end
		end,
	});

	for i, f in ipairs(steps) do
		f();
	end

	-- Add the Array Declaration
	table.insert(ast.body.statements, 1, Ast.LocalVariableDeclaration(self.rootScope, {self.arrId}, {self:createArray()}));

	self.rootScope = nil;
	self.arrId = nil;

	self.constants = nil;
	self.lookup = nil;
end

return ConstantArray;
`,"prometheus.steps.EncryptStrings":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- EncryptStrings.lua
--
-- This Script provides a Simple Obfuscation Step that encrypts strings

local Step = require("prometheus.step")
local Ast = require("prometheus.ast")
local Parser = require("prometheus.parser")
local Enums = require("prometheus.enums")
local visitast = require("prometheus.visitast");
local util = require("prometheus.util")
local AstKind = Ast.AstKind;

local EncryptStrings = Step:extend()
EncryptStrings.Description = "This Step will encrypt strings within your Program."
EncryptStrings.Name = "Encrypt Strings"

EncryptStrings.SettingsDescriptor = {}

function EncryptStrings:init(_) end


function EncryptStrings:CreateEncryptionService()
	local usedSeeds = {};

	local secret_key_6 = math.random(0, 63) -- 6-bit  arbitrary integer (0..63)
	local secret_key_7 = math.random(0, 127) -- 7-bit  arbitrary integer (0..127)
	local secret_key_44 = math.random(0, 17592186044415) -- 44-bit arbitrary integer (0..17592186044415)
	local secret_key_8 = math.random(0, 255); -- 8-bit  arbitrary integer (0..255)

	local floor = math.floor

	local function primitive_root_257(idx)
		local g, m, d = 1, 128, 2 * idx + 1
		repeat
			g, m, d = g * g * (d >= m and 3 or 1) % 257, m / 2, d % m
		until m < 1
		return g
	end

	local param_mul_8 = primitive_root_257(secret_key_7)
	local param_mul_45 = secret_key_6 * 4 + 1
	local param_add_45 = secret_key_44 * 2 + 1

	local state_45 = 0
	local state_8 = 2

	local prev_values = {}
	local function set_seed(seed_53)
		state_45 = seed_53 % 35184372088832
		state_8 = seed_53 % 255 + 2
		prev_values = {}
	end

	local function gen_seed()
		local seed;
		repeat
			seed = math.random(0, 35184372088832);
		until not usedSeeds[seed];
		usedSeeds[seed] = true;
		return seed;
	end

	local function get_random_32()
		state_45 = (state_45 * param_mul_45 + param_add_45) % 35184372088832
		repeat
			state_8 = state_8 * param_mul_8 % 257
		until state_8 ~= 1
		local r = state_8 % 32
		local n = floor(state_45 / 2 ^ (13 - (state_8 - r) / 32)) % 2 ^ 32 / 2 ^ r
		return floor(n % 1 * 2 ^ 32) + floor(n)
	end

	local function get_next_pseudo_random_byte()
		if #prev_values == 0 then
			local rnd = get_random_32() -- value 0..4294967295
			local low_16 = rnd % 65536
			local high_16 = (rnd - low_16) / 65536
			local b1 = low_16 % 256
			local b2 = (low_16 - b1) / 256
			local b3 = high_16 % 256
			local b4 = (high_16 - b3) / 256
			prev_values = { b1, b2, b3, b4 }
		end
		--print(unpack(prev_values))
		return table.remove(prev_values)
	end

	local function encrypt(str)
		local seed = gen_seed();
		set_seed(seed)
		local len = string.len(str)
		local out = {}
		local prevVal = secret_key_8;
		for i = 1, len do
			local byte = string.byte(str, i);
			out[i] = string.char((byte - (get_next_pseudo_random_byte() + prevVal)) % 256);
			prevVal = byte;
		end
		return table.concat(out), seed;
	end

    local function genCode()
        local code = [[
do
	]] .. table.concat(util.shuffle{
		"local floor = math.floor",
		"local random = math.random",
		"local remove = table.remove",
		"local char = string.char",
		"local state_45 = 0",
		"local state_8 = 2",
		"local charmap = {}",
		"local nums = {}"
	}, "\\n") .. [[
	for i = 1, 256 do
		nums[i] = i;
	end

	repeat
		local idx = random(1, #nums);
		local n = remove(nums, idx);
		charmap[n] = char(n - 1);
	until #nums == 0;

	local prev_values = {}
	local function get_next_pseudo_random_byte()
		if #prev_values == 0 then
			state_45 = (state_45 * ]] .. tostring(param_mul_45) .. [[ + ]] .. tostring(param_add_45) .. [[) % 35184372088832
			repeat
				state_8 = state_8 * ]] .. tostring(param_mul_8) .. [[ % 257
			until state_8 ~= 1
			local r = state_8 % 32
			local shift = 13 - (state_8 - r) / 32
			local n = floor(state_45 / 2 ^ shift) % 4294967296 / 2 ^ r
			local rnd = floor(n % 1 * 4294967296) + floor(n)
			local low_16 = rnd % 65536
			local high_16 = (rnd - low_16) / 65536
			prev_values = { low_16 % 256, (low_16 - low_16 % 256) / 256, high_16 % 256, (high_16 - high_16 % 256) / 256 }
		end


		local prevValuesLen = #prev_values;
		local removed = prev_values[prevValuesLen];
		prev_values[prevValuesLen] = nil;
		return removed;
	end

	local realStrings = {};
	STRINGS = setmetatable({}, {
		__index = realStrings;
		__metatable = nil;
	});
  	function DECRYPT(str, seed)
		local realStringsLocal = realStrings;
		if(realStringsLocal[seed]) then return seed; else
			prev_values = {};
			local chars = charmap;
			state_45 = seed % 35184372088832
			state_8 = seed % 255 + 2
			local len = #str;
			realStringsLocal[seed] = "";
			local prevVal = ]] .. tostring(secret_key_8) .. [[;
			local s = "";
			for i=1, len, 1 do
				prevVal = (string.byte(str, i) + get_next_pseudo_random_byte() + prevVal) % 256
				s = s .. chars[prevVal + 1];
			end
			realStringsLocal[seed] = s;
		end
		return seed;
	end
end]]

		return code;
    end

    return {
        encrypt = encrypt,
        param_mul_45 = param_mul_45,
        param_mul_8 = param_mul_8,
        param_add_45 = param_add_45,
		secret_key_8 = secret_key_8,
        genCode = genCode,
    }
end

function EncryptStrings:apply(ast, _)
    local Encryptor = self:CreateEncryptionService();

	local code = Encryptor.genCode();
	local newAst = Parser:new({ LuaVersion = Enums.LuaVersion.Lua51 }):parse(code);
	local doStat = newAst.body.statements[1];

	local scope = ast.body.scope;
	local decryptVar = scope:addVariable();
	local stringsVar = scope:addVariable();

	doStat.body.scope:setParent(ast.body.scope);

	visitast(newAst, nil, function(node, data)
		if(node.kind == AstKind.FunctionDeclaration) then
			if(node.scope:getVariableName(node.id) == "DECRYPT") then
				data.scope:removeReferenceToHigherScope(node.scope, node.id);
				data.scope:addReferenceToHigherScope(scope, decryptVar);
				node.scope = scope;
				node.id = decryptVar;
			end
		end
		if(node.kind == AstKind.AssignmentVariable or node.kind == AstKind.VariableExpression) then
			if(node.scope:getVariableName(node.id) == "STRINGS") then
				data.scope:removeReferenceToHigherScope(node.scope, node.id);
				data.scope:addReferenceToHigherScope(scope, stringsVar);
				node.scope = scope;
				node.id = stringsVar;
			end
		end
	end)

	visitast(ast, nil, function(node, data)
		if(node.kind == AstKind.StringExpression) then
			data.scope:addReferenceToHigherScope(scope, stringsVar);
			data.scope:addReferenceToHigherScope(scope, decryptVar);
			local encrypted, seed = Encryptor.encrypt(node.value);
			return Ast.IndexExpression(Ast.VariableExpression(scope, stringsVar), Ast.FunctionCallExpression(Ast.VariableExpression(scope, decryptVar), {
				Ast.StringExpression(encrypted), Ast.NumberExpression(seed),
			}));
		end
	end)


	-- Insert to Main Ast
	table.insert(ast.body.statements, 1, doStat);
	table.insert(ast.body.statements, 1, Ast.LocalVariableDeclaration(scope, util.shuffle{ decryptVar, stringsVar }, {}));
	return ast
end

return EncryptStrings
`,"prometheus.steps.NumbersToExpressions":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- NumbersToExpressions.lua
--
-- This Script provides an Obfuscation Step, that converts Number Literals to expressions.
-- This step can now also convert numbers to different representations!
-- Supported representations: hex, binary, scientific, normal. Please note that binary is only supported in Lua 5.2 and above.

unpack = unpack or table.unpack

local Step = require("prometheus.step")
local Ast = require("prometheus.ast")
local visitast = require("prometheus.visitast")
local util = require("prometheus.util")
local logger = require("logger")
local AstKind = Ast.AstKind

local NumbersToExpressions = Step:extend()
NumbersToExpressions.Description = "This Step Converts number Literals to Expressions"
NumbersToExpressions.Name = "Numbers To Expressions"

NumbersToExpressions.SettingsDescriptor = {
	Threshold = {
		type = "number",
		default = 1,
		min = 0,
		max = 1,
	},

	InternalThreshold = {
		type = "number",
		default = 0.2,
		min = 0,
		max = 0.8,
	},

	NumberRepresentationMutation = {
		type = "boolean",
		default = false,
		aliases = { "NumberRepresentationMutaton" },
	},

	AllowedNumberRepresentations = {
		type = "table",
		default = {"hex", "scientific", "normal"},
		values = {"hex", "binary", "scientific", "normal"},
	},
}

local function generateModuloExpression(n)
	local rhs = n + math.random(1, 2^24)
	local multiplier = math.random(1, 2^8)
	local lhs = n + (multiplier * rhs)
	return lhs, rhs
end

local function contains(table, value)
	for _, v in ipairs(table) do
		if v == value then
			return true
		end
	end
	return false
end

function NumbersToExpressions:init(_)
	self.ExpressionGenerators = {
		function(val, depth) -- Addition
			local val2 = math.random(-2 ^ 20, 2 ^ 20)
			local diff = val - val2
			if tonumber(tostring(diff)) + tonumber(tostring(val2)) ~= val then
				return false
			end
			return Ast.AddExpression(
				self:CreateNumberExpression(val2, depth),
				self:CreateNumberExpression(diff, depth),
				false
			)
		end,

		function(val, depth) -- Subtraction
			local val2 = math.random(-2 ^ 20, 2 ^ 20)
			local diff = val + val2
			if tonumber(tostring(diff)) - tonumber(tostring(val2)) ~= val then
				return false
			end
			return Ast.SubExpression(
				self:CreateNumberExpression(diff, depth),
				self:CreateNumberExpression(val2, depth),
				false
			)
		end,

		function(val, depth) -- Modulo
			local lhs, rhs = generateModuloExpression(val)
			if tonumber(tostring(lhs)) % tonumber(tostring(rhs)) ~= val then
				return false
			end
			return Ast.ModExpression(
				self:CreateNumberExpression(lhs, depth),
				self:CreateNumberExpression(rhs, depth),
				false
			)
		end,
	}
end

function NumbersToExpressions:CreateNumberExpression(val, depth)
	if depth > 0 and math.random() >= self.InternalThreshold or depth > 15 then
		local format = self.AllowedNumberRepresentations[math.random(1, #self.AllowedNumberRepresentations)]
		if not self.NumberRepresentationMutation then
			return Ast.NumberExpression(val)
		end

		if format == "hex" then
			if val ~= math.floor(val) or val < 0 then
				return Ast.NumberExpression(val)
			end
			local hexStr = string.format("0x%X", val)
			local result = ""
			for i = 1, #hexStr do
				local c = hexStr:sub(i, i)
				if math.random() > 0.5 then
					result = result .. c:upper()
				else
					result = result .. c:lower()
				end
			end
			return Ast.NumberExpression(result)
		end

		if format == "binary" then
			if val ~= math.floor(val) or val < 0 then
				return Ast.NumberExpression(val)
			end
			local binary = ""
			local n = val
			if n == 0 then
				binary = "0"
			else
				while n > 0 do
					binary = (n % 2) .. binary
					n = math.floor(n / 2)
				end
			end
			return Ast.NumberExpression("0b" .. binary)
		end

		if format == "scientific" then
			if val == 0 then
				return Ast.NumberExpression(val)
			end

			local exp = math.floor(math.log10(math.abs(val)))
			local mantissa = val / (10 ^ exp)
			return Ast.NumberExpression(string.format("%.15ge%d", mantissa, exp))
		end

		if format == "normal" then
			return Ast.NumberExpression(val)
		end
	end

	local generators = util.shuffle({ unpack(self.ExpressionGenerators) })
	for _, generator in ipairs(generators) do
		local node = generator(val, depth + 1)
		if node then
			return node
		end
	end
	return Ast.NumberExpression(val)
end

function NumbersToExpressions:apply(ast)
	if contains(self.AllowedNumberRepresentations, "binary") then
		logger:warn("Warning: Binary representation is only supported in Lua 5.2 and above!")
	end

	visitast(ast, nil, function(node, _)
		if node.kind == AstKind.NumberExpression then
			if math.random() <= self.Threshold then
				return self:CreateNumberExpression(node.value, 0)
			end
		end
	end)
end

return NumbersToExpressions
`,"prometheus.steps.ProxifyLocals":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- ProxifyLocals.lua
--
-- This Script provides a Obfuscation Step for putting all Locals into Proxy Objects

local Step = require("prometheus.step");
local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");
local visitast = require("prometheus.visitast");
local RandomLiterals = require("prometheus.randomLiterals")

local AstKind = Ast.AstKind;

local ProxifyLocals = Step:extend();
ProxifyLocals.Description = "This Step wraps all locals into Proxy Objects";
ProxifyLocals.Name = "Proxify Locals";

ProxifyLocals.SettingsDescriptor = {
	LiteralType = {
		name = "LiteralType",
		description = "The type of the randomly generated literals",
		type = "enum",
		values = {
			"dictionary",
			"number",
			"string",
            "any",
		},
		default = "string",
	},
}

local function shallowcopy(orig)
    local orig_type = type(orig)
    local copy
    if orig_type == 'table' then
        copy = {}
        for orig_key, orig_value in pairs(orig) do
            copy[orig_key] = orig_value
        end
    else -- number, string, boolean, etc
        copy = orig
    end
    return copy
end

local function callNameGenerator(generatorFunction, ...)
	if(type(generatorFunction) == "table") then
		generatorFunction = generatorFunction.generateName;
	end
	return generatorFunction(...);
end

local MetatableExpressions = {
    {
        constructor = Ast.AddExpression,
        key = "__add";
    },
    {
        constructor = Ast.SubExpression,
        key = "__sub";
    },
    {
        constructor = Ast.IndexExpression,
        key = "__index";
    },
    {
        constructor = Ast.MulExpression,
        key = "__mul";
    },
    {
        constructor = Ast.DivExpression,
        key = "__div";
    },
    {
        constructor = Ast.PowExpression,
        key = "__pow";
    },
    {
        constructor = Ast.StrCatExpression,
        key = "__concat";
    }
}

function ProxifyLocals:init(_) end

local function generateLocalMetatableInfo(pipeline)
    local usedOps = {};
    local info = {};
    for i, v in ipairs({"setValue", "getValue", "index"}) do
        local rop;
        repeat
            rop = MetatableExpressions[math.random(#MetatableExpressions)];
        until not usedOps[rop];
        usedOps[rop] = true;
        info[v] = rop;
    end

    info.valueName = callNameGenerator(pipeline.namegenerator, math.random(1, 4096));

    return info;
end

function ProxifyLocals:CreateAssignmentExpression(info, expr, parentScope)
    local metatableVals = {};

    -- Setvalue Entry
    local setValueFunctionScope = Scope:new(parentScope);
    local setValueSelf = setValueFunctionScope:addVariable();
    local setValueArg = setValueFunctionScope:addVariable();
    local setvalueFunctionLiteral = Ast.FunctionLiteralExpression(
        {
            Ast.VariableExpression(setValueFunctionScope, setValueSelf), -- Argument 1
            Ast.VariableExpression(setValueFunctionScope, setValueArg), -- Argument 2
        },
        Ast.Block({ -- Create Function Body
            Ast.AssignmentStatement({
                Ast.AssignmentIndexing(Ast.VariableExpression(setValueFunctionScope, setValueSelf), Ast.StringExpression(info.valueName));
            }, {
                Ast.VariableExpression(setValueFunctionScope, setValueArg)
            })
        }, setValueFunctionScope)
    );
    table.insert(metatableVals, Ast.KeyedTableEntry(Ast.StringExpression(info.setValue.key), setvalueFunctionLiteral));

    -- Getvalue Entry
    local getValueFunctionScope = Scope:new(parentScope);
    local getValueSelf = getValueFunctionScope:addVariable();
    local getValueArg = getValueFunctionScope:addVariable();
    local getValueIdxExpr;
    if(info.getValue.key == "__index" or info.setValue.key == "__index") then
        getValueIdxExpr = Ast.FunctionCallExpression(Ast.VariableExpression(getValueFunctionScope:resolveGlobal("rawget")), {
            Ast.VariableExpression(getValueFunctionScope, getValueSelf),
            Ast.StringExpression(info.valueName),
        });
    else
        getValueIdxExpr = Ast.IndexExpression(Ast.VariableExpression(getValueFunctionScope, getValueSelf), Ast.StringExpression(info.valueName));
    end
    local getvalueFunctionLiteral = Ast.FunctionLiteralExpression(
        {
            Ast.VariableExpression(getValueFunctionScope, getValueSelf), -- Argument 1
            Ast.VariableExpression(getValueFunctionScope, getValueArg), -- Argument 2
        },
        Ast.Block({ -- Create Function Body
            Ast.ReturnStatement({
                getValueIdxExpr;
            });
        }, getValueFunctionScope)
    );
    table.insert(metatableVals, Ast.KeyedTableEntry(Ast.StringExpression(info.getValue.key), getvalueFunctionLiteral));

    parentScope:addReferenceToHigherScope(self.setMetatableVarScope, self.setMetatableVarId);
    return Ast.FunctionCallExpression(
        Ast.VariableExpression(self.setMetatableVarScope, self.setMetatableVarId),
        {
            Ast.TableConstructorExpression({
                Ast.KeyedTableEntry(Ast.StringExpression(info.valueName), expr)
            }),
            Ast.TableConstructorExpression(metatableVals)
        }
    );
end

function ProxifyLocals:apply(ast, pipeline)
    local localMetatableInfos = {};
    local function getLocalMetatableInfo(scope, id)
        -- Global Variables should not be transformed
        if(scope.isGlobal) then return nil end;

        localMetatableInfos[scope] = localMetatableInfos[scope] or {};
        if localMetatableInfos[scope][id] then
            -- If locked, return no Metatable
            if localMetatableInfos[scope][id].locked then
                return nil
            end
            return localMetatableInfos[scope][id];
        end
        local localMetatableInfo = generateLocalMetatableInfo(pipeline);
        localMetatableInfos[scope][id] = localMetatableInfo;
        return localMetatableInfo;
    end

    local function disableMetatableInfo(scope, id)
        -- Global Variables should not be transformed
        if(scope.isGlobal) then return nil end;

        localMetatableInfos[scope] = localMetatableInfos[scope] or {};
        localMetatableInfos[scope][id] = {locked = true}
    end

    -- Create Setmetatable Variable
    self.setMetatableVarScope = ast.body.scope;
    self.setMetatableVarId = ast.body.scope:addVariable();

    -- Create Empty Function Variable
    self.emptyFunctionScope = ast.body.scope;
    self.emptyFunctionId = ast.body.scope:addVariable();
    self.emptyFunctionUsed = false;

    -- Add Empty Function Declaration
    table.insert(ast.body.statements, 1, Ast.LocalVariableDeclaration(self.emptyFunctionScope, {self.emptyFunctionId}, {
        Ast.FunctionLiteralExpression({}, Ast.Block({}, Scope:new(ast.body.scope)));
    }));


    visitast(ast, function(node, data)
        -- Lock for loop variables
        if(node.kind == AstKind.ForStatement) then
            disableMetatableInfo(node.scope, node.id)
        end
        if(node.kind == AstKind.ForInStatement) then
            for i, id in ipairs(node.ids) do
                disableMetatableInfo(node.scope, id);
            end
        end

        -- Lock Function Arguments
        if(node.kind == AstKind.FunctionDeclaration or node.kind == AstKind.LocalFunctionDeclaration or node.kind == AstKind.FunctionLiteralExpression) then
            for i, expr in ipairs(node.args) do
                if expr.kind == AstKind.VariableExpression then
                    disableMetatableInfo(expr.scope, expr.id);
                end
            end
        end

        -- Assignment Statements may be Obfuscated Differently
        if(node.kind == AstKind.AssignmentStatement) then
            if(#node.lhs == 1 and node.lhs[1].kind == AstKind.AssignmentVariable) then
                local variable = node.lhs[1];
                local localMetatableInfo = getLocalMetatableInfo(variable.scope, variable.id);
                if localMetatableInfo then
                    local args = shallowcopy(node.rhs);
                    local vexp = Ast.VariableExpression(variable.scope, variable.id);
                    vexp.__ignoreProxifyLocals = true;
                    args[1] = localMetatableInfo.setValue.constructor(vexp, args[1]);
                    self.emptyFunctionUsed = true;
                    data.scope:addReferenceToHigherScope(self.emptyFunctionScope, self.emptyFunctionId);
                    return Ast.FunctionCallStatement(Ast.VariableExpression(self.emptyFunctionScope, self.emptyFunctionId), args);
                end
            end
        end
    end, function(node, data)
        -- Local Variable Declaration
        if(node.kind == AstKind.LocalVariableDeclaration) then
            for i, id in ipairs(node.ids) do
                local expr = node.expressions[i] or Ast.NilExpression();
                local localMetatableInfo = getLocalMetatableInfo(node.scope, id);
                -- Apply Only to Some Variables if Threshold is non 1
                if localMetatableInfo then
                    local newExpr = self:CreateAssignmentExpression(localMetatableInfo, expr, node.scope);
                    node.expressions[i] = newExpr;
                end
            end
        end

        -- Variable Expression
        if(node.kind == AstKind.VariableExpression and not node.__ignoreProxifyLocals) then
            local localMetatableInfo = getLocalMetatableInfo(node.scope, node.id);
            -- Apply Only to Some Variables if Threshold is non 1
            if localMetatableInfo then
                local literal;
                if self.LiteralType == "dictionary" then
                    literal = RandomLiterals.Dictionary();
                elseif self.LiteralType == "number" then
                    literal = RandomLiterals.Number();
                elseif self.LiteralType == "string" then
                    literal = RandomLiterals.String(pipeline);
                else
                    literal = RandomLiterals.Any(pipeline);
                end
                return localMetatableInfo.getValue.constructor(node, literal);
            end
        end

        -- Assignment Variable for Assignment Statement
        if(node.kind == AstKind.AssignmentVariable) then
            local localMetatableInfo = getLocalMetatableInfo(node.scope, node.id);
            -- Apply Only to Some Variables if Threshold is non 1
            if localMetatableInfo then
                return Ast.AssignmentIndexing(node, Ast.StringExpression(localMetatableInfo.valueName));
            end
        end

        -- Local Function Declaration
        if(node.kind == AstKind.LocalFunctionDeclaration) then
            local localMetatableInfo = getLocalMetatableInfo(node.scope, node.id);
            -- Apply Only to Some Variables if Threshold is non 1
            if localMetatableInfo then
                local funcLiteral = Ast.FunctionLiteralExpression(node.args, node.body);
                local newExpr = self:CreateAssignmentExpression(localMetatableInfo, funcLiteral, node.scope);
                return Ast.LocalVariableDeclaration(node.scope, {node.id}, {newExpr});
            end
        end

        -- Function Declaration
        if(node.kind == AstKind.FunctionDeclaration) then
            local localMetatableInfo = getLocalMetatableInfo(node.scope, node.id);
            if(localMetatableInfo) then
                table.insert(node.indices, 1, localMetatableInfo.valueName);
            end
        end
    end)

    -- Add Setmetatable Variable Declaration
    table.insert(ast.body.statements, 1, Ast.LocalVariableDeclaration(self.setMetatableVarScope, {self.setMetatableVarId}, {
        Ast.VariableExpression(self.setMetatableVarScope:resolveGlobal("setmetatable"))
    }));
end

return ProxifyLocals;`,"prometheus.steps.SplitStrings":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- SplitStrings.lua
--
-- This Script provides a Simple Obfuscation Step for splitting Strings

local Step = require("prometheus.step");
local Ast = require("prometheus.ast");
local visitAst = require("prometheus.visitast");
local Parser = require("prometheus.parser");
local util = require("prometheus.util");
local enums = require("prometheus.enums")

local LuaVersion = enums.LuaVersion;

local SplitStrings = Step:extend();
SplitStrings.Description = "This Step splits Strings to a specific or random length";
SplitStrings.Name = "Split Strings";

SplitStrings.SettingsDescriptor = {
	Threshold = {
		name = "Threshold",
		description = "The relative amount of nodes that will be affected",
		type = "number",
		default = 1,
		min = 0,
		max = 1,
	},
	MinLength = {
		name = "MinLength",
		description = "The minimal length for the chunks in that the Strings are splitted",
		type = "number",
		default = 5,
		min = 1,
		max = nil,
	},
	MaxLength = {
		name = "MaxLength",
		description = "The maximal length for the chunks in that the Strings are splitted",
		type = "number",
		default = 5,
		min = 1,
		max = nil,
	},
	ConcatenationType = {
		name = "ConcatenationType",
		description = "The Functions used for Concatenation. Note that when using custom, the String Array will also be Shuffled",
		type = "enum",
		values = {
			"strcat",
			"table",
			"custom",
		},
		default = "custom",
	},
	CustomFunctionType = {
		name = "CustomFunctionType",
		description = "The Type of Function code injection This Option only applies when custom Concatenation is selected.\\
Note that when choosing inline, the code size may increase significantly!",
		type = "enum",
		values = {
			"global",
			"local",
			"inline",
		},
		default = "global",
	},
	CustomLocalFunctionsCount = {
		name = "CustomLocalFunctionsCount",
		description = "The number of local functions per scope. This option only applies when CustomFunctionType = local",
		type = "number",
		default = 2,
		min = 1,
	}
}

function SplitStrings:init(settings) end

local function generateTableConcatNode(chunks, data)
	local chunkNodes = {};
	for i, chunk in ipairs(chunks) do
		table.insert(chunkNodes, Ast.TableEntry(Ast.StringExpression(chunk)));
	end
	local tb = Ast.TableConstructorExpression(chunkNodes);
	data.scope:addReferenceToHigherScope(data.tableConcatScope, data.tableConcatId);
	return Ast.FunctionCallExpression(Ast.VariableExpression(data.tableConcatScope, data.tableConcatId), {tb});
end

local function generateStrCatNode(chunks)
	-- Put Together Expression for Concatenating String
	local generatedNode = nil;
	for i, chunk in ipairs(chunks) do
		if generatedNode then
			generatedNode = Ast.StrCatExpression(generatedNode, Ast.StringExpression(chunk));
		else
			generatedNode = Ast.StringExpression(chunk);
		end
	end
	return generatedNode
end

local customVariants = 2;
local custom1Code = [=[
function custom(table)
    local stringTable, str = table[#table], "";
    for i=1,#stringTable, 1 do
        str = str .. stringTable[table[i]];
	end
	return str
end
]=];

local custom2Code = [=[
function custom(tb)
	local str = "";
	for i=1, #tb / 2, 1 do
		str = str .. tb[#tb / 2 + tb[i]];
	end
	return str
end
]=];

local function generateCustomNodeArgs(chunks, data, variant)
	local shuffled = {};
	local shuffledIndices = {};
	for i = 1, #chunks, 1 do
		shuffledIndices[i] = i;
	end
	util.shuffle(shuffledIndices);

	for i, v in ipairs(shuffledIndices) do
		shuffled[v] = chunks[i];
	end

	-- Custom Function Type 1
	if variant == 1 then
		local args = {};
		local tbNodes = {};

		for i, v in ipairs(shuffledIndices) do
			table.insert(args, Ast.TableEntry(Ast.NumberExpression(v)));
		end

		for i, chunk in ipairs(shuffled) do
			table.insert(tbNodes, Ast.TableEntry(Ast.StringExpression(chunk)));
		end

		local tb = Ast.TableConstructorExpression(tbNodes);

		table.insert(args, Ast.TableEntry(tb));
		return {Ast.TableConstructorExpression(args)};

	-- Custom Function Type 2
	else

		local args = {};
		for i, v in ipairs(shuffledIndices) do
			table.insert(args, Ast.TableEntry(Ast.NumberExpression(v)));
		end
		for i, chunk in ipairs(shuffled) do
			table.insert(args, Ast.TableEntry(Ast.StringExpression(chunk)));
		end
		return {Ast.TableConstructorExpression(args)};
	end

end

local function generateCustomFunctionLiteral(parentScope, variant)
	local parser = Parser:new({
		LuaVersion = LuaVersion.Lua51;
	});

	-- Custom Function Type 1
	if variant == 1 then
		local funcDeclNode = parser:parse(custom1Code).body.statements[1];
		local funcBody = funcDeclNode.body;
		local funcArgs = funcDeclNode.args;
		funcBody.scope:setParent(parentScope);
		return Ast.FunctionLiteralExpression(funcArgs, funcBody);

		-- Custom Function Type 2
	else
		local funcDeclNode = parser:parse(custom2Code).body.statements[1];
		local funcBody = funcDeclNode.body;
		local funcArgs = funcDeclNode.args;
		funcBody.scope:setParent(parentScope);
		return Ast.FunctionLiteralExpression(funcArgs, funcBody);
	end
end

local function generateGlobalCustomFunctionDeclaration(ast, data)
	local parser = Parser:new({
		LuaVersion = LuaVersion.Lua51;
	});

	-- Custom Function Type 1
	if data.customFunctionVariant == 1 then
		local astScope = ast.body.scope;
		local funcDeclNode = parser:parse(custom1Code).body.statements[1];
		local funcBody = funcDeclNode.body;
		local funcArgs = funcDeclNode.args;
		funcBody.scope:setParent(astScope);
		return Ast.LocalVariableDeclaration(astScope, {data.customFuncId},
		{Ast.FunctionLiteralExpression(funcArgs, funcBody)});
	-- Custom Function Type 2
	else
		local astScope = ast.body.scope;
		local funcDeclNode = parser:parse(custom2Code).body.statements[1];
		local funcBody = funcDeclNode.body;
		local funcArgs = funcDeclNode.args;
		funcBody.scope:setParent(astScope);
		return Ast.LocalVariableDeclaration(data.customFuncScope, {data.customFuncId},
		{Ast.FunctionLiteralExpression(funcArgs, funcBody)});
	end
end

function SplitStrings:variant()
	return math.random(1, customVariants);
end

function SplitStrings:apply(ast, pipeline)
	local data = {};


	if(self.ConcatenationType == "table") then
		local scope = ast.body.scope;
		local id = scope:addVariable();
		data.tableConcatScope = scope;
		data.tableConcatId = id;
	elseif(self.ConcatenationType == "custom") then
		data.customFunctionType = self.CustomFunctionType;
		if data.customFunctionType == "global" then
			local scope = ast.body.scope;
			local id = scope:addVariable();
			data.customFuncScope = scope;
			data.customFuncId = id;
			data.customFunctionVariant = self:variant();
		end
	end


	local customLocalFunctionsCount = self.CustomLocalFunctionsCount;
	local self2 = self;

	visitAst(ast, function(node, data)
		-- Previsit Function

		-- Create Local Function declarations
		if(self.ConcatenationType == "custom" and data.customFunctionType == "local" and node.kind == Ast.AstKind.Block and node.isFunctionBlock) then
			data.functionData.localFunctions = {};
			for i = 1, customLocalFunctionsCount, 1 do
				local scope = data.scope;
				local id = scope:addVariable();
				local variant = self:variant();
				table.insert(data.functionData.localFunctions, {
					scope = scope,
					id = id,
					variant = variant,
					used = false,
				});
			end
		end

	end, function(node, data)
		-- PostVisit Function

		-- Create actual function literals for local customFunctionType
		if(self.ConcatenationType == "custom" and data.customFunctionType == "local" and node.kind == Ast.AstKind.Block and node.isFunctionBlock) then
			for i, func in ipairs(data.functionData.localFunctions) do
				if func.used then
					local literal = generateCustomFunctionLiteral(func.scope, func.variant);
					table.insert(node.statements, 1, Ast.LocalVariableDeclaration(func.scope, {func.id}, {literal}));
				end
			end
		end


		-- Apply Only to String nodes
		if(node.kind == Ast.AstKind.StringExpression) then
			local str = node.value;
			if string.len(str) <= 4096 then
			local chunks = {};
			local i = 1;

			-- Split String into Parts of length between MinLength and MaxLength
			while i <= string.len(str) do
				local len = math.random(self.MinLength, self.MaxLength);
				table.insert(chunks, string.sub(str, i, i + len - 1));
				i = i + len;
			end

			if(#chunks > 1) then
				if math.random() < self.Threshold then
					if self.ConcatenationType == "strcat" then
						node = generateStrCatNode(chunks);
					elseif self.ConcatenationType == "table" then
						node = generateTableConcatNode(chunks, data);
					elseif self.ConcatenationType == "custom" then
						if self.CustomFunctionType == "global" then
							local args = generateCustomNodeArgs(chunks, data, data.customFunctionVariant);
							-- Add Reference for Variable Renaming
							data.scope:addReferenceToHigherScope(data.customFuncScope, data.customFuncId);
							node = Ast.FunctionCallExpression(Ast.VariableExpression(data.customFuncScope, data.customFuncId), args);
						elseif self.CustomFunctionType == "local" then
							local lfuncs = data.functionData.localFunctions;
							local idx = math.random(1, #lfuncs);
							local func = lfuncs[idx];
							local args = generateCustomNodeArgs(chunks, data, func.variant);
							func.used = true;
							-- Add Reference for Variable Renaming
							data.scope:addReferenceToHigherScope(func.scope, func.id);
							node = Ast.FunctionCallExpression(Ast.VariableExpression(func.scope, func.id), args);
						elseif self.CustomFunctionType == "inline" then
							local variant = self:variant();
							local args = generateCustomNodeArgs(chunks, data, variant);
							local literal = generateCustomFunctionLiteral(data.scope, variant);
							node = Ast.FunctionCallExpression(literal, args);
						end
					end
				end
			end

			end
			return node, true;
		end
	end, data)


	if(self.ConcatenationType == "table") then
		local globalScope = data.globalScope;
		local tableScope, tableId = globalScope:resolve("table")
		ast.body.scope:addReferenceToHigherScope(globalScope, tableId);
		table.insert(ast.body.statements, 1, Ast.LocalVariableDeclaration(data.tableConcatScope, {data.tableConcatId},
		{Ast.IndexExpression(Ast.VariableExpression(tableScope, tableId), Ast.StringExpression("concat"))}));
	elseif(self.ConcatenationType == "custom" and self.CustomFunctionType == "global") then
		table.insert(ast.body.statements, 1, generateGlobalCustomFunctionDeclaration(ast, data));
	end
end

return SplitStrings;`,"prometheus.steps.Vmify":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- Vmify.lua
--
-- This Script provides a Complex Obfuscation Step that will compile the entire Script to  a fully custom bytecode that does not share it's instructions
-- with lua, making it much harder to crack than other lua obfuscators

local Step = require("prometheus.step");
local Compiler = require("prometheus.compiler.compiler");

local Vmify = Step:extend();
Vmify.Description = "This Step will Compile your script into a fully-custom (not a half custom like other lua obfuscators) Bytecode Format and emit a vm for executing it.";
Vmify.Name = "Vmify";

Vmify.SettingsDescriptor = {}

function Vmify:init(_) end

function Vmify:apply(ast)
    -- Create Compiler
	local compiler = Compiler:new();

    -- Compile the Script into a bytecode vm
    return compiler:compile(ast);
end

return Vmify;`,"prometheus.steps.Watermark":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- Watermark.lua
--
-- This Script provides a Step that will add a watermark to the script

local Step = require("prometheus.step");
local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");

local Watermark = Step:extend();
Watermark.Description = "This Step will add a watermark to the script";
Watermark.Name = "Watermark";

Watermark.SettingsDescriptor = {
  Content = {
    name = "Content",
    description = "The Content of the Watermark",
    type = "string",
    default = "This Script is Part of the Prometheus Obfuscator by levno-710",
  },
  CustomVariable = {
    name = "Custom Variable",
    description = "The Variable that will be used for the Watermark",
    type = "string",
    default = "_WATERMARK",
  }
}

function Watermark:init(settings)
	
end

function Watermark:apply(ast)
  local body = ast.body;
  if string.len(self.Content) > 0 then
    local scope, variable = ast.globalScope:resolve(self.CustomVariable);
    local watermark = Ast.AssignmentVariable(ast.globalScope, variable);

    local functionScope = Scope:new(body.scope);
    functionScope:addReferenceToHigherScope(ast.globalScope, variable);
    
    local arg = functionScope:addVariable();
    local statement = Ast.PassSelfFunctionCallStatement(Ast.StringExpression(self.Content), "gsub", {
      Ast.StringExpression(".+"),
      Ast.FunctionLiteralExpression({
        Ast.VariableExpression(functionScope, arg)
      }, Ast.Block({
        Ast.AssignmentStatement({
          watermark
        }, {
          Ast.VariableExpression(functionScope, arg)
        })
      }, functionScope))
    });

    table.insert(ast.body.statements, 1, statement)
  end
end

return Watermark;`,"prometheus.steps.WatermarkCheck":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- WatermarkCheck.lua
--
-- This Script provides a Step that will add a watermark to the script

local Step = require("prometheus.step");
local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");
local Watermark = require("prometheus.steps.Watermark");

local WatermarkCheck = Step:extend();
WatermarkCheck.Description = "This Step will add a watermark to the script";
WatermarkCheck.Name = "WatermarkCheck";

WatermarkCheck.SettingsDescriptor = {
  Content = {
    name = "Content",
    description = "The Content of the WatermarkCheck",
    type = "string",
    default = "This Script is Part of the Prometheus Obfuscator by levno-710",
  },
}

local function callNameGenerator(generatorFunction, ...)
	if(type(generatorFunction) == "table") then
		generatorFunction = generatorFunction.generateName;
	end
	return generatorFunction(...);
end

function WatermarkCheck:init(_) end

function WatermarkCheck:apply(ast, pipeline)
  self.CustomVariable = "_" .. callNameGenerator(pipeline.namegenerator, math.random(10000000000, 100000000000));
  pipeline:addStep(Watermark:new(self));

  local body = ast.body;
  local watermarkExpression = Ast.StringExpression(self.Content);
  local scope, variable = ast.globalScope:resolve(self.CustomVariable);
  local watermark = Ast.VariableExpression(ast.globalScope, variable);
  local notEqualsExpression = Ast.NotEqualsExpression(watermark, watermarkExpression);
  local ifBody = Ast.Block({Ast.ReturnStatement({})}, Scope:new(ast.body.scope));

  table.insert(body.statements, 1, Ast.IfStatement(notEqualsExpression, ifBody, {}, nil));
end

return WatermarkCheck;`,"prometheus.steps.WrapInFunction":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- WrapInFunction.lua
--
-- This Script provides a Simple Obfuscation Step that wraps the entire Script into a function

local Step = require("prometheus.step");
local Ast = require("prometheus.ast");
local Scope = require("prometheus.scope");

local WrapInFunction = Step:extend();
WrapInFunction.Description = "This Step Wraps the Entire Script into a Function";
WrapInFunction.Name = "Wrap in Function";

WrapInFunction.SettingsDescriptor = {
	Iterations = {
		name = "Iterations",
		description = "The Number Of Iterations",
		type = "number",
		default = 1,
		min = 1,
		max = nil,
	}
}

function WrapInFunction:init(_) end

function WrapInFunction:apply(ast)
	for i = 1, self.Iterations, 1 do
		local body = ast.body;

		local scope = Scope:new(ast.globalScope);
		body.scope:setParent(scope);

		ast.body = Ast.Block({
			Ast.ReturnStatement({
				Ast.FunctionCallExpression(Ast.FunctionLiteralExpression({Ast.VarargExpression()}, body), {Ast.VarargExpression()})
			});
		}, scope);
	end
end

return WrapInFunction;`,"prometheus.steps":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- steps.lua
--
-- This Script provides a collection of obfuscation steps.

return {
	WrapInFunction = require("prometheus.steps.WrapInFunction"),
	SplitStrings = require("prometheus.steps.SplitStrings"),
	Vmify = require("prometheus.steps.Vmify"),
	ConstantArray = require("prometheus.steps.ConstantArray"),
	ProxifyLocals = require("prometheus.steps.ProxifyLocals"),
	AntiTamper = require("prometheus.steps.AntiTamper"),
	EncryptStrings = require("prometheus.steps.EncryptStrings"),
	NumbersToExpressions = require("prometheus.steps.NumbersToExpressions"),
	AddVararg = require("prometheus.steps.AddVararg"),
	WatermarkCheck = require("prometheus.steps.WatermarkCheck"),
}`,"prometheus.tokenizer":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- tokenizer.lua
-- Overview:
-- This Script provides a class for lexical Analysis of lua code.
-- This Tokenizer is Capable of tokenizing LuaU and Lua5.1
local Enums = require("prometheus.enums");
local util = require("prometheus.util");
local logger = require("logger");
local config = require("config");

local LuaVersion = Enums.LuaVersion;
local lookupify = util.lookupify;
local unlookupify = util.unlookupify;
local escape = util.escape;
local chararray = util.chararray;
local keys = util.keys;
local Tokenizer = {};

Tokenizer.EOF_CHAR = "<EOF>";
Tokenizer.WHITESPACE_CHARS = lookupify{
	" ", "\\t", "\\n", "\\r",
}

Tokenizer.ANNOTATION_CHARS = lookupify(chararray("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"))
Tokenizer.ANNOTATION_START_CHARS = lookupify(chararray("!@"))

Tokenizer.Conventions = Enums.Conventions;

Tokenizer.TokenKind = {
	Eof = "Eof",
	Keyword = "Keyword",
	Symbol = "Symbol",
	Ident = "Identifier",
	Number = "Number",
	String = "String",
}

Tokenizer.EOF_TOKEN = {
	kind = Tokenizer.TokenKind.Eof,
	value = "<EOF>",
	startPos = -1,
	endPos = -1,
	source = "<EOF>",
}

local function token(self, startPos, kind, value)
	local line, linePos = self:getPosition(self.index);
	local annotations = self.annotations
	self.annotations = {};
	return {
		kind = kind,
		value = value,
		startPos = startPos,
		endPos = self.index,
		source = self.source:sub(startPos + 1, self.index),
		line = line,
		linePos = linePos,
		annotations = annotations,
	}
end

local function generateError(self, message)
	local line, linePos = self:getPosition(self.index);
	return "Lexing Error at Position " .. tostring(line) .. ":" .. tostring(linePos) .. ", " .. message;
end

local function generateWarning(token, message)
	return "Warning at Position " .. tostring(token.line) .. ":" .. tostring(token.linePos) .. ", " .. message;
end

function Tokenizer:getPosition(i)
	local column = self.columnMap[i]

	if not column then --// \`i\` is bigger than self.length, this shouldn't happen, but it did. (Theres probably some error in the tokenizer, cant find it.)
		column = self.columnMap[#self.columnMap]
	end

	return column.id, column.charMap[i]
end

--// Prepare columnMap for getPosition
function Tokenizer:prepareGetPosition()
	local columnMap, column = {}, { charMap = {}, id = 1, length = 0 }

	for index = 1, self.length do
		local character = string.sub(self.source, index, index) -- NOTE_1: this could use table.clone to reduce amount of NEWTABLE (if that causes any performance issues)

		local columnLength = column.length + 1
		column.length = columnLength
		column.charMap[index] = columnLength

		if character == "\\n" then
			column = { charMap = {}, id = column.id + 1, length = 0 } -- NOTE_1
		end

		columnMap[index] = column
	end

	self.columnMap = columnMap
end

-- Constructor for Tokenizer
function Tokenizer:new(settings)
	local luaVersion = (settings and (settings.luaVersion or settings.LuaVersion)) or LuaVersion.LuaU;
	local conventions = Tokenizer.Conventions[luaVersion];

	if(conventions == nil) then
		logger:error("The Lua Version \\"" .. luaVersion .. "\\" is not recognized by the Tokenizer! Please use one of the following: \\"" .. table.concat(keys(Tokenizer.Conventions), "\\",\\"") .. "\\"");
	end

	local tokenizer = {
		index = 0, -- Index where the current char is read
		length = 0,
		source = "", -- Source to Tokenize
		luaVersion = luaVersion, -- LuaVersion to be used while Tokenizing
		conventions = conventions;

		NumberChars = conventions.NumberChars,
		NumberCharsLookup = lookupify(conventions.NumberChars),
		Keywords = conventions.Keywords,
		KeywordsLookup = lookupify(conventions.Keywords),
		BinaryNumberChars = conventions.BinaryNumberChars,
		BinaryNumberCharsLookup = lookupify(conventions.BinaryNumberChars);
		BinaryNums = conventions.BinaryNums,
		HexadecimalNums = conventions.HexadecimalNums,
		HexNumberChars = conventions.HexNumberChars,
		HexNumberCharsLookup = lookupify(conventions.HexNumberChars),
		DecimalExponent = conventions.DecimalExponent,
		DecimalSeperators = conventions.DecimalSeperators,
		IdentChars = conventions.IdentChars,
		IdentCharsLookup = lookupify(conventions.IdentChars),

		EscapeSequences = conventions.EscapeSequences,
		NumericalEscapes = conventions.NumericalEscapes,
		EscapeZIgnoreNextWhitespace = conventions.EscapeZIgnoreNextWhitespace,
		HexEscapes = conventions.HexEscapes,
		UnicodeEscapes = conventions.UnicodeEscapes,

		SymbolChars = conventions.SymbolChars,
		SymbolCharsLookup = lookupify(conventions.SymbolChars),
		MaxSymbolLength = conventions.MaxSymbolLength,
		Symbols = conventions.Symbols,
		SymbolsLookup = lookupify(conventions.Symbols),

		StringStartLookup = lookupify({"\\"", "\\'"}),
		annotations = {},
	};

	setmetatable(tokenizer, self);
	self.__index = self;

	return tokenizer;
end

-- Reset State of Tokenizer to Tokenize another File
function Tokenizer:reset()
	self.index = 0;
	self.length = 0;
	self.source = "";
	self.annotations = {};
	self.columnMap = {};
end

-- Append String to this Tokenizer
function Tokenizer:append(code)
	self.source = self.source .. code
	self.length = self.length + code:len();
	self:prepareGetPosition();
end

-- Function to peek the n'th char in the source of the tokenizer
local function peek(self, n)
	n = n or 0;
	local i = self.index + n + 1;
	if i > self.length then
		return Tokenizer.EOF_CHAR
	end
	return self.source:sub(i, i);
end

-- Function to get the next char in the source
local function get(self)
	local i = self.index + 1;
	if i > self.length then
		logger:error(generateError(self, "Unexpected end of Input"));
	end
	self.index = self.index + 1;
	return self.source:sub(i, i);
end

-- The same as get except it throws an Error if the char is not contained in charOrLookup
local function expect(self, charOrLookup)
	if(type(charOrLookup) == "string") then
		charOrLookup = {[charOrLookup] = true};
	end

	local char = peek(self);
	if charOrLookup[char] ~= true then
		local etb = unlookupify(charOrLookup);
		for i, v in ipairs(etb) do
			etb[i] = escape(v);
		end
		local errorMessage = "Unexpected char \\"" .. escape(char) .. "\\"! Expected one of \\"" .. table.concat(etb, "\\",\\"") .. "\\"";
		logger:error(generateError(self, errorMessage));
	end

	self.index = self.index + 1;
	return char;
end

-- Returns wether the n'th char is in the lookup
local function is(self, charOrLookup, n)
	local char = peek(self, n);
	if(type(charOrLookup) == "string") then
		return char == charOrLookup;
	end
	return charOrLookup[char];
end

function Tokenizer:parseAnnotation()
	if is(self, Tokenizer.ANNOTATION_START_CHARS) then
		self.index = self.index + 1;
		local source, length = {}, 0;
		while(is(self, Tokenizer.ANNOTATION_CHARS)) do
			source[length + 1] = get(self)
			length = #source
		end
		if length > 0 then
			self.annotations[string.lower(table.concat(source))] = true;
		end
		return nil;
	end
	return get(self);
end

-- skip one or 0 Comments and return wether one was found
function Tokenizer:skipComment()
	if(is(self, "-", 0) and is(self, "-", 1)) then
		self.index = self.index + 2;
		if(is(self, "[")) then
			self.index = self.index + 1;
			local eqCount = 0;
			while(is(self, "=")) do
				self.index = self.index + 1;
				eqCount = eqCount + 1;
			end
			if(is(self, "[")) then
				-- Multiline Comment
				-- Get all Chars to Closing bracket but also consider that the count of equal signs must be the same
				while true do
					if(self:parseAnnotation() == ']') then
						local eqCount2 = 0;
						while(is(self, "=")) do
							self.index = self.index + 1;
							eqCount2 = eqCount2 + 1;
						end
						if(is(self, "]")) then
							if(eqCount2 == eqCount) then
								self.index = self.index + 1;
								return true
							end
						end
					end
				end
			end
		end
		-- Single Line Comment
		-- Get all Chars to next Newline
		while(self.index < self.length and self:parseAnnotation() ~= "\\n") do end
		return true;
	end
	return false;
end

-- skip All Whitespace and Comments to next Token
function Tokenizer:skipWhitespaceAndComments()
	while self:skipComment() do end
	while is(self, Tokenizer.WHITESPACE_CHARS) do
		self.index = self.index + 1;
		while self:skipComment() do end
	end
end

local function int(self, chars, seperators)
	local buffer = {};
	while true do
		if (is(self, chars)) then
			buffer[#buffer + 1] = get(self)
		elseif (is(self, seperators)) then
			self.index = self.index + 1;
		else
			break
		end
	end
	return table.concat(buffer);
end

-- Lex the next token as a Number
function Tokenizer:number()
	local startPos = self.index;
	local source = expect(self, setmetatable({["."] = true}, {__index = self.NumberCharsLookup}));

	if source == "0" then
		if self.BinaryNums and is(self, lookupify(self.BinaryNums)) then
			self.index = self.index + 1;
			source = int(self, self.BinaryNumberCharsLookup, lookupify(self.DecimalSeperators or {}));
			local value = tonumber(source, 2);
			return token(self, startPos, Tokenizer.TokenKind.Number, value);
		end

		if self.HexadecimalNums and is(self, lookupify(self.HexadecimalNums)) then
			self.index = self.index + 1;
			source = int(self, self.HexNumberCharsLookup, lookupify(self.DecimalSeperators or {}));
			local value = tonumber(source, 16);
			return token(self, startPos, Tokenizer.TokenKind.Number, value);
		end
	end

	if source == "." then
		source = source .. int(self, self.NumberCharsLookup, lookupify(self.DecimalSeperators or {}));
	else
		source = source .. int(self, self.NumberCharsLookup, lookupify(self.DecimalSeperators or {}));
		if(is(self, ".")) then
			source = source .. get(self) .. int(self, self.NumberCharsLookup, lookupify(self.DecimalSeperators or {}));
		end
	end

	if(self.DecimalExponent and is(self, lookupify(self.DecimalExponent))) then
		source = source .. get(self);
		if(is(self, lookupify({"+","-"}))) then
			source = source .. get(self);
		end
		local v = int(self, self.NumberCharsLookup, lookupify(self.DecimalSeperators or {}));
		if(v:len() < 1) then
			logger:error(generateError(self, "Expected a Valid Exponent!"));
		end
		source = source .. v;
	end

	local value = tonumber(source);
	return token(self, startPos, Tokenizer.TokenKind.Number, value);
end

-- Lex the Next Token as Identifier or Keyword
function Tokenizer:ident()
	local startPos = self.index;
	local source = expect(self, self.IdentCharsLookup)
	local sourceAddContent = {source}
	while(is(self, self.IdentCharsLookup)) do
		-- source = source .. get(self);
		table.insert(sourceAddContent, get(self))
	end
	source = table.concat(sourceAddContent)
	if(self.KeywordsLookup[source]) then
		return token(self, startPos, Tokenizer.TokenKind.Keyword, source);
	end

	local tk = token(self, startPos, Tokenizer.TokenKind.Ident, source);

	if(string.sub(source, 1, string.len(config.IdentPrefix)) == config.IdentPrefix) then
		logger:warn(generateWarning(tk, string.format("identifiers should not start with \\"%s\\" as this may break the program", config.IdentPrefix)));
	end

	return tk;
end

function Tokenizer:singleLineString()
	local startPos = self.index;
	local startChar = expect(self, self.StringStartLookup);
	local buffer = {};

	while (not is(self, startChar)) do
		local char = get(self);

		-- Single Line String may not contain Linebreaks except when they are escaped by \\
		if(char == '\\n') then
			self.index = self.index - 1;
			logger:error(generateError(self, "Unterminated String"));
		end


		if(char == "\\\\") then
			char = get(self);

			local escape = self.EscapeSequences[char];
			if(type(escape) == "string") then
				char = escape;

			elseif(self.NumericalEscapes and self.NumberCharsLookup[char]) then
				local numstr = char;

				if(is(self, self.NumberCharsLookup)) then
					char = get(self);
					numstr = numstr .. char;
				end

				if(is(self, self.NumberCharsLookup)) then
					char = get(self);
					numstr = numstr .. char;
				end

				char = string.char(tonumber(numstr));

			elseif(self.UnicodeEscapes and char == "u") then
				expect(self, "{");
				local num = "";
				while (is(self, self.HexNumberCharsLookup)) do
					num = num .. get(self);
				end
				expect(self, "}");
				char = util.utf8char(tonumber(num, 16));
			elseif(self.HexEscapes and char == "x") then
				local hex = expect(self, self.HexNumberCharsLookup) .. expect(self, self.HexNumberCharsLookup);
				char = string.char(tonumber(hex, 16));
			elseif(self.EscapeZIgnoreNextWhitespace and char == "z") then
				char = "";
				while(is(self, Tokenizer.WHITESPACE_CHARS)) do
					self.index = self.index + 1;
				end
			end
		end

		--// since table.insert is slower in lua51
		buffer[#buffer + 1] = char
	end

	expect(self, startChar);

	return token(self, startPos, Tokenizer.TokenKind.String, table.concat(buffer))
end

function Tokenizer:multiLineString()
	local startPos = self.index;
	if(is(self, "[")) then
		self.index = self.index + 1;
		local eqCount = 0;
		while(is(self, "=")) do
			self.index = self.index + 1;
			eqCount = eqCount + 1;
		end
		if(is(self, "[")) then
			-- Multiline String
			-- Parse String to Closing bracket but also consider that the count of equal signs must be the same

			-- Skip Leading newline if existing
			self.index = self.index + 1;
			if(is(self, "\\n")) then
				self.index = self.index + 1;
			end

			local value = "";
			while true do
				local char = get(self);
				if(char == ']') then
					local eqCount2 = 0;
					while(is(self, "=")) do
						char = char .. get(self);
						eqCount2 = eqCount2 + 1;
					end
					if(is(self, "]")) then
						if(eqCount2 == eqCount) then
							self.index = self.index + 1;
							return token(self, startPos, Tokenizer.TokenKind.String, value), true
						end
					end
				end
				value = value .. char;
			end
		end
	end
	self.index = startPos;
	return nil, false -- There was not an actual multiline string at the given Position
end

function Tokenizer:symbol()
	local startPos = self.index;
	for len = self.MaxSymbolLength, 1, -1 do
		local str = self.source:sub(self.index + 1, self.index + len);
		if self.SymbolsLookup[str] then
			self.index = self.index + len;
			return token(self, startPos, Tokenizer.TokenKind.Symbol, str);
		end
	end
	logger:error(generateError(self, "Unknown Symbol"));
end


-- get the Next token
function Tokenizer:next()
	-- Skip All Whitespace before the token
	self:skipWhitespaceAndComments();

	local startPos = self.index;
	if startPos >= self.length then
		return token(self, startPos, Tokenizer.TokenKind.Eof);
	end

	-- Numbers
	if(is(self, self.NumberCharsLookup)) then
		return self:number();
	end

	-- Identifiers and Keywords
	if(is(self, self.IdentCharsLookup)) then
		return self:ident();
	end

	-- Singleline String Literals
	if(is(self, self.StringStartLookup)) then
		return self:singleLineString();
	end

	-- Multiline String Literals
	if(is(self, "[", 0)) then
		-- The isString variable is due to the fact that "[" could also be a symbol for indexing
		local value, isString = self:multiLineString();
		if isString then
			return value;
		end
	end

	-- Number starting with dot
	if(is(self, ".") and is(self, self.NumberCharsLookup, 1)) then
		return self:number();
	end

	-- Symbols
	if(is(self, self.SymbolCharsLookup)) then
		return self:symbol();
	end


	logger:error(generateError(self, "Unexpected char \\"" .. escape(peek(self)) .. "\\"!"));
end

function Tokenizer:scanAll()
	local tb = {};
	repeat
		local token = self:next();
		table.insert(tb, token);
	until token.kind == Tokenizer.TokenKind.Eof
	return tb
end

return Tokenizer
`,"prometheus.unparser":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- unparser.lua
-- Overview:
-- This Script provides a class for lua code generation from an ast
-- This UnParser is Capable of generating LuaU and Lua5.1
--
-- Note that a LuaU ast can only be unparsed as LuaU if it contains any continue statements
--
-- Settings Object:
-- luaVersion : The LuaVersion of the Script

local config = require("config");
local Ast = require("prometheus.ast");
local Enums = require("prometheus.enums");
local util = require("prometheus.util");
local logger = require("logger");

local lookupify = util.lookupify;
local LuaVersion = Enums.LuaVersion;
local AstKind = Ast.AstKind;

local Unparser = {}

Unparser.SPACE = config.SPACE;
Unparser.TAB = config.TAB;

local function escapeString(str)
	str = util.escape(str)
	return str;
end

function Unparser:new(settings)
	local luaVersion = settings.LuaVersion or LuaVersion.LuaU;
	local conventions = Enums.Conventions[luaVersion];
	local unparser = {
		luaVersion = luaVersion;
		conventions = conventions;
		identCharsLookup = lookupify(conventions.IdentChars);
		numberCharsLookup = lookupify(conventions.NumberChars);
		prettyPrint = settings and settings.PrettyPrint or false;
		notIdentPattern = "[^" .. table.concat(conventions.IdentChars, "") .. "]";
		numberPattern = "^[" .. table.concat(conventions.NumberChars, "") .. "]";
		highlight = settings and settings.Highlight or false;
		keywordsLookup = lookupify(conventions.Keywords);
	}

	setmetatable(unparser, self);
	self.__index = self;

	return unparser;
end

function Unparser:isValidIdentifier(source)
	if(string.find(source, self.notIdentPattern)) then
		return false;
	end
	if(string.find(source, self.numberPattern)) then
		return false;
	end
	if self.keywordsLookup[source] then
		return false;
	end
	return #source > 0;
end

function Unparser:setPrettyPrint(prettyPrint)
	self.prettyPrint = prettyPrint;
end

function Unparser:getPrettyPrint()
	return self.prettyPrint;
end

function Unparser:tabs(i, ws_needed)
	return self.prettyPrint and string.rep(self.TAB, i) or ws_needed and self.SPACE or "";
end

function Unparser:newline(ws_needed)
	return self.prettyPrint and "\\n" or ws_needed and self.SPACE or "";
end

function Unparser:whitespaceIfNeeded(following, ws)
	if(self.prettyPrint or self.identCharsLookup[string.sub(following, 1, 1)]) then
		return ws or self.SPACE;
	end
	return "";
end

function Unparser:whitespaceIfNeeded2(leading, ws)
	if(self.prettyPrint or self.identCharsLookup[string.sub(leading, #leading, #leading)]) then
		return ws or self.SPACE;
	end
	return "";
end

function Unparser:optionalWhitespace(ws)
	return self.prettyPrint and (ws or self.SPACE) or "";
end

function Unparser:whitespace(ws)
	return self.SPACE or ws;
end

function Unparser:unparse(ast)
	if(ast.kind ~= AstKind.TopNode) then
		logger:error("Unparser:unparse expects a TopNode as first argument")
	end

	return self:unparseBlock(ast.body);
end

-- Helper to join parts table (optimized string building)
local function joinParts(parts)
	return table.concat(parts)
end

function Unparser:unparseBlock(block, tabbing)
	if(#block.statements < 1) then
		return self:whitespace();
	end

	local parts = {}

	for i, statement in ipairs(block.statements) do
		if(statement.kind ~= AstKind.NopStatement) then
			local statementCode = self:unparseStatement(statement, tabbing);
			if(not self.prettyPrint and #parts > 0 and string.sub(statementCode, 1, 1) == "(") then
				-- This is so that the following works:
				-- print("Test");(function() print("Test2") end)();
				statementCode = ";" .. statementCode;
			end
			local ws = self:whitespaceIfNeeded2(#parts > 0 and parts[#parts] or "", self:whitespaceIfNeeded(statementCode, self:newline(true)));
			if i ~= 1 then
				parts[#parts + 1] = ws;
			end
			if(self.prettyPrint) then
				statementCode = statementCode .. ";"
			end
			parts[#parts + 1] = statementCode;
		end
	end

	return joinParts(parts);
end

function Unparser:unparseStatement(statement, tabbing)
	tabbing = tabbing and tabbing + 1 or 0;
	local parts = {};
	local function push(...) -- Helper to add multiple strings efficiently
		for i = 1, select('#', ...) do
			parts[#parts + 1] = select(i, ...)
		end
	end

	if(statement.kind == AstKind.ContinueStatement) then
		push("continue");

	-- Break Statement
	elseif(statement.kind == AstKind.BreakStatement) then
		push("break");

	-- Do Statement
	elseif(statement.kind == AstKind.DoStatement) then
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push("do", self:whitespaceIfNeeded(bodyCode, self:newline(true)),
			bodyCode, self:newline(false),
			self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");

	-- While Statement
	elseif(statement.kind == AstKind.WhileStatement) then
		local expressionCode = self:unparseExpression(statement.condition, tabbing);
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push("while", self:whitespaceIfNeeded(expressionCode), expressionCode, self:whitespaceIfNeeded2(expressionCode),
			"do", self:whitespaceIfNeeded(bodyCode, self:newline(true)),
			bodyCode, self:newline(false),
			self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");

	-- Repeat Until Statement
	elseif(statement.kind == AstKind.RepeatStatement) then
		local expressionCode = self:unparseExpression(statement.condition, tabbing);
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push("repeat", self:whitespaceIfNeeded(bodyCode, self:newline(true)),
			bodyCode,
			self:whitespaceIfNeeded2(bodyCode, self:newline() .. self:tabs(tabbing, true)), "until",
			self:whitespaceIfNeeded(expressionCode), expressionCode);

	-- For Statement
	elseif(statement.kind == AstKind.ForStatement) then
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push("for", self:whitespace(), statement.scope:getVariableName(statement.id), self:optionalWhitespace(), "=");
		push(self:optionalWhitespace(), self:unparseExpression(statement.initialValue, tabbing), ",");
		push(self:optionalWhitespace(), self:unparseExpression(statement.finalValue, tabbing), ",");
		local incrementByCode = statement.incrementBy and self:unparseExpression(statement.incrementBy, tabbing) or "1";
		push(self:optionalWhitespace(), incrementByCode, self:whitespaceIfNeeded2(incrementByCode), "do",
			self:whitespaceIfNeeded(bodyCode, self:newline(true)),
			bodyCode, self:newline(false),
			self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");

	-- For In Statement
	elseif(statement.kind == AstKind.ForInStatement) then
		push("for", self:whitespace());
		for i, id in ipairs(statement.ids) do
			if(i ~= 1) then
				push(",", self:optionalWhitespace());
			end
			push(statement.scope:getVariableName(id));
		end
		push(self:whitespace(), "in");
		local exprcode = self:unparseExpression(statement.expressions[1], tabbing);
		push(self:whitespaceIfNeeded(exprcode), exprcode);
		for i = 2, #statement.expressions, 1 do
			exprcode = self:unparseExpression(statement.expressions[i], tabbing);
			push(",", self:optionalWhitespace(), exprcode);
		end
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push(self:whitespaceIfNeeded2(#parts > 0 and parts[#parts] or ""), "do", self:whitespaceIfNeeded(bodyCode, self:newline(true)),
			bodyCode, self:newline(false),
			self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");

	-- If Statement
	elseif(statement.kind == AstKind.IfStatement) then
		local exprcode = self:unparseExpression(statement.condition, tabbing);
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push("if", self:whitespaceIfNeeded(exprcode), exprcode, self:whitespaceIfNeeded2(exprcode), "then",
			self:whitespaceIfNeeded(bodyCode, self:newline(true)), bodyCode);

		for i, eif in ipairs(statement.elseifs) do
			exprcode = self:unparseExpression(eif.condition, tabbing);
			bodyCode = self:unparseBlock(eif.body, tabbing);
			local lastPart = #parts > 0 and parts[#parts] or "";
			push(self:newline(false), self:whitespaceIfNeeded2(lastPart, self:tabs(tabbing, true)),
				"elseif", self:whitespaceIfNeeded(exprcode), exprcode, self:whitespaceIfNeeded2(exprcode),
				"then", self:whitespaceIfNeeded(bodyCode, self:newline(true)), bodyCode);
		end

		if(statement.elsebody) then
			bodyCode = self:unparseBlock(statement.elsebody, tabbing);
			local lastPart = #parts > 0 and parts[#parts] or "";
			push(self:newline(false), self:whitespaceIfNeeded2(lastPart, self:tabs(tabbing, true)),
				"else", self:whitespaceIfNeeded(bodyCode, self:newline(true)), bodyCode);
		end

		push(self:newline(false), self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");

	-- Function Declaration
	elseif(statement.kind == AstKind.FunctionDeclaration) then
		local funcname = statement.scope:getVariableName(statement.id);
		for _, index in ipairs(statement.indices) do
			funcname = funcname .. "." .. index;
		end
		push("function", self:whitespace(), funcname, "(");
		for i, arg in ipairs(statement.args) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			if(arg.kind == AstKind.VarargExpression) then
				push("...");
			else
				push(arg.scope:getVariableName(arg.id));
			end
		end
		push(")");
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push(self:newline(false), bodyCode, self:newline(false),
			self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");

	-- Local Function Declaration
	elseif(statement.kind == AstKind.LocalFunctionDeclaration) then
		local funcname = statement.scope:getVariableName(statement.id);
		push("local", self:whitespace(), "function", self:whitespace(), funcname, "(");
		for i, arg in ipairs(statement.args) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			if(arg.kind == AstKind.VarargExpression) then
				push("...");
			else
				push(arg.scope:getVariableName(arg.id));
			end
		end
		push(")");
		local bodyCode = self:unparseBlock(statement.body, tabbing);
		push(self:newline(false), bodyCode, self:newline(false),
			self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");

	-- Local Variable Declaration
	elseif(statement.kind == AstKind.LocalVariableDeclaration) then
		push("local", self:whitespace());
		for i, id in ipairs(statement.ids) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			push(statement.scope:getVariableName(id));
		end
		if(#statement.expressions > 0) then
			push(self:optionalWhitespace(), "=", self:optionalWhitespace());
			for i, expr in ipairs(statement.expressions) do
				if i > 1 then
					push(",", self:optionalWhitespace());
				end
				push(self:unparseExpression(expr, tabbing + 1));
			end
		end

	-- Function Call Statement
	elseif(statement.kind == AstKind.FunctionCallStatement) then
		if not (statement.base.kind == AstKind.IndexExpression or statement.base.kind == AstKind.VariableExpression) then
			push("(", self:unparseExpression(statement.base, tabbing), ")");
		else
			push(self:unparseExpression(statement.base, tabbing));
		end
		push("(");
		for i, arg in ipairs(statement.args) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			push(self:unparseExpression(arg, tabbing));
		end
		push(")");

	-- Pass Self Function Call Statement
	elseif(statement.kind == AstKind.PassSelfFunctionCallStatement) then
		if not (statement.base.kind == AstKind.IndexExpression or statement.base.kind == AstKind.VariableExpression) then
			push("(", self:unparseExpression(statement.base, tabbing), ")");
		else
			push(self:unparseExpression(statement.base, tabbing));
		end
		push(":", statement.passSelfFunctionName, "(");
		for i, arg in ipairs(statement.args) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			push(self:unparseExpression(arg, tabbing));
		end
		push(")");

	elseif(statement.kind == AstKind.AssignmentStatement) then
		for i, primary_expr in ipairs(statement.lhs) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			push(self:unparseExpression(primary_expr, tabbing));
		end
		push(self:optionalWhitespace(), "=", self:optionalWhitespace());
		for i, expr in ipairs(statement.rhs) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			push(self:unparseExpression(expr, tabbing + 1));
		end

	-- Return Statement
	elseif(statement.kind == AstKind.ReturnStatement) then
		push("return");
		if(#statement.args > 0) then
			local exprcode = self:unparseExpression(statement.args[1], tabbing);
			push(self:whitespaceIfNeeded(exprcode), exprcode);
			for i = 2, #statement.args, 1 do
				exprcode = self:unparseExpression(statement.args[i], tabbing);
				push(",", self:optionalWhitespace(), exprcode);
			end
		end

	elseif self.luaVersion == LuaVersion.LuaU then
		local compoundOperators = {
			[AstKind.CompoundAddStatement] = "+=",
			[AstKind.CompoundSubStatement] = "-=",
			[AstKind.CompoundMulStatement] = "*=",
			[AstKind.CompoundDivStatement] = "/=",
			[AstKind.CompoundModStatement] = "%=",
			[AstKind.CompoundPowStatement] = "^=",
			[AstKind.CompoundConcatStatement] = "..=",
		}

		local operator = compoundOperators[statement.kind]
		if operator then
			push(self:unparseExpression(statement.lhs, tabbing), self:optionalWhitespace(), operator,
				self:optionalWhitespace(), self:unparseExpression(statement.rhs, tabbing));
		else
			logger:error(string.format("\\"%s\\" is not a valid unparseable statement in %s!", statement.kind, self.luaVersion))
		end
	end

	return self:tabs(tabbing, false) .. joinParts(parts);
end

function Unparser:unparseExpression(expression, tabbing)
	if expression.isParenthesizedExpression then
		local unwrapped = {}
		for k, v in pairs(expression) do
			unwrapped[k] = v
		end
		unwrapped.isParenthesizedExpression = nil
		return "(" .. self:unparseExpression(unwrapped, tabbing) .. ")"
	end

	local parts = {};
	local function push(...)
		for i = 1, select('#', ...) do
			parts[#parts + 1] = select(i, ...)
		end
	end

	if(expression.kind == AstKind.BooleanExpression) then
		return expression.value and "true" or "false";
	end

	if(expression.kind == AstKind.NumberExpression) then
		local str = tostring(expression.value);
		if(str == "inf") then
			return "2e1024"
		end
		if(str == "-inf") then
			return "-2e1024"
		end
		if(str:sub(1, 2) == "0.") then
			str = str:sub(2);
		end
		return str;
	end

	if(expression.kind == AstKind.VariableExpression or expression.kind == AstKind.AssignmentVariable) then
		return expression.scope:getVariableName(expression.id);
	end

	if(expression.kind == AstKind.StringExpression) then
		return "\\"" .. escapeString(expression.value) .. "\\"";
	end

	if(expression.kind == AstKind.NilExpression) then
		return "nil";
	end

	if(expression.kind == AstKind.VarargExpression) then
		return "...";
	end

	local k = AstKind.OrExpression;
	if(expression.kind == k) then
		local lhs = self:unparseExpression(expression.lhs, tabbing);
		local rhs = self:unparseExpression(expression.rhs, tabbing);
		return lhs .. self:whitespaceIfNeeded2(lhs) .. "or" .. self:whitespaceIfNeeded(rhs) .. rhs;
	end

	k = AstKind.AndExpression;
	if(expression.kind == k) then
		local lhs = self:unparseExpression(expression.lhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.lhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			lhs = "(" .. lhs .. ")";
		end

		local rhs = self:unparseExpression(expression.rhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.rhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			rhs = "(" .. rhs .. ")";
		end

		return lhs .. self:whitespaceIfNeeded2(lhs) .. "and" .. self:whitespaceIfNeeded(rhs) .. rhs;
	end

	local comparisonOps = {
		[AstKind.LessThanExpression] = "<",
		[AstKind.GreaterThanExpression] = ">",
		[AstKind.LessThanOrEqualsExpression] = "<=",
		[AstKind.GreaterThanOrEqualsExpression] = ">=",
		[AstKind.NotEqualsExpression] = "~=",
		[AstKind.EqualsExpression] = "==",
	}

	local op = comparisonOps[expression.kind]
	if op then
		k = expression.kind
		local lhs = self:unparseExpression(expression.lhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.lhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			lhs = "(" .. lhs .. ")";
		end

		local rhs = self:unparseExpression(expression.rhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.rhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			rhs = "(" .. rhs .. ")";
		end

		return lhs .. self:optionalWhitespace() .. op .. self:optionalWhitespace() .. rhs;
	end

	k = AstKind.StrCatExpression
	if expression.kind == k then
		local lhs = self:unparseExpression(expression.lhs, tabbing)
		if Ast.astKindExpressionToNumber(expression.lhs.kind) >= Ast.astKindExpressionToNumber(k) then
			lhs = "(" .. lhs .. ")"
		end

		local rhs = self:unparseExpression(expression.rhs, tabbing)
		if Ast.astKindExpressionToNumber(expression.rhs.kind) >= Ast.astKindExpressionToNumber(k) then
			rhs = "(" .. rhs .. ")"
		end

		if self.numberCharsLookup[string.sub(lhs, #lhs, #lhs)] then
			lhs = lhs .. " "
		end

		return lhs .. self:optionalWhitespace() .. (tostring(rhs):sub(1, 1) == "." and ".. " or "..") .. self:optionalWhitespace() .. rhs
	end

	local arithmeticOps = {
		[AstKind.AddExpression] = "+",
		[AstKind.SubExpression] = "-",
		[AstKind.MulExpression] = "*",
		[AstKind.DivExpression] = "/",
		[AstKind.ModExpression] = "%",
		[AstKind.PowExpression] = "^",
	}

	op = arithmeticOps[expression.kind]
	if op then
		k = expression.kind
		local lhs = self:unparseExpression(expression.lhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.lhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			lhs = "(" .. lhs .. ")";
		end

		local rhs = self:unparseExpression(expression.rhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.rhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			rhs = "(" .. rhs .. ")";
		end

		if op == "-" and string.sub(rhs, 1, 1) == "-" then
			rhs = "(" .. rhs .. ")";
		end

		return lhs .. self:optionalWhitespace() .. op .. self:optionalWhitespace() .. rhs;
	end

	-- Unary Expressions
	k = AstKind.NotExpression;
	if(expression.kind == k) then
		local rhs = self:unparseExpression(expression.rhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.rhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			rhs = "(" .. rhs .. ")";
		end

		return "not" .. self:whitespaceIfNeeded(rhs) .. rhs;
	end

	k = AstKind.NegateExpression;
	if(expression.kind == k) then
		local rhs = self:unparseExpression(expression.rhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.rhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			rhs = "(" .. rhs .. ")";
		end

		if string.sub(rhs, 1, 1) == "-" then
			rhs = "(" .. rhs .. ")";
		end

		return "-" .. rhs;
	end

	k = AstKind.LenExpression;
	if(expression.kind == k) then
		local rhs = self:unparseExpression(expression.rhs, tabbing);
		if(Ast.astKindExpressionToNumber(expression.rhs.kind) >= Ast.astKindExpressionToNumber(k)) then
			rhs = "(" .. rhs .. ")";
		end

		return "#" .. rhs;
	end

	k = AstKind.IndexExpression;
	if(expression.kind == k or expression.kind == AstKind.AssignmentIndexing) then
		local base = self:unparseExpression(expression.base, tabbing);
		if(expression.base.kind == AstKind.VarargExpression or Ast.astKindExpressionToNumber(expression.base.kind) > Ast.astKindExpressionToNumber(k) or expression.base.kind == AstKind.StringExpression or expression.base.kind == AstKind.NumberExpression or expression.base.kind == AstKind.NilExpression) then
			base = "(" .. base .. ")";
		end

		-- Identifier Indexing e.g: x.y instead of x["y"];
		if(expression.index.kind == AstKind.StringExpression and self:isValidIdentifier(expression.index.value)) then
			return base .. "." .. expression.index.value;
		end

		-- Index never needs parens
		local index = self:unparseExpression(expression.index, tabbing);
		return base .. "[" .. index .. "]";
	end

	k = AstKind.FunctionCallExpression;
	if(expression.kind == k) then
		if not (expression.base.kind == AstKind.IndexExpression or expression.base.kind == AstKind.VariableExpression) then
			push("(", self:unparseExpression(expression.base, tabbing), ")");
		else
			push(self:unparseExpression(expression.base, tabbing));
		end
		push("(");
		for i, arg in ipairs(expression.args) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			push(self:unparseExpression(arg, tabbing));
		end
		push(")");
		return joinParts(parts);
	end

	k = AstKind.PassSelfFunctionCallExpression;
	if(expression.kind == k) then
		if not (expression.base.kind == AstKind.IndexExpression or expression.base.kind == AstKind.VariableExpression) then
			push("(", self:unparseExpression(expression.base, tabbing), ")");
		else
			push(self:unparseExpression(expression.base, tabbing));
		end
		push(":", expression.passSelfFunctionName, "(");
		for i, arg in ipairs(expression.args) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			push(self:unparseExpression(arg, tabbing));
		end
		push(")");
		return joinParts(parts);
	end

	k = AstKind.FunctionLiteralExpression;
	if(expression.kind == k) then
		push("function", "(");
		for i, arg in ipairs(expression.args) do
			if i > 1 then
				push(",", self:optionalWhitespace());
			end
			if(arg.kind == AstKind.VarargExpression) then
				push("...");
			else
				push(arg.scope:getVariableName(arg.id));
			end
		end
		push(")");
		local bodyCode = self:unparseBlock(expression.body, tabbing);
		push(self:newline(false), bodyCode, self:newline(false),
			self:whitespaceIfNeeded2(bodyCode, self:tabs(tabbing, true)), "end");
		return joinParts(parts);
	end

	k = AstKind.TableConstructorExpression;
	if(expression.kind == k) then
		if(#expression.entries == 0) then return "{}" end;

		local inlineTable = #expression.entries <= 3;
		local tableTabbing = tabbing + 1;

		push("{");
		if inlineTable then
			push(self:optionalWhitespace());
		else
			push(self:optionalWhitespace(self:newline() .. self:tabs(tableTabbing)));
		end

		local p = false;
		for i, entry in ipairs(expression.entries) do
			p = true;
			local sep = self.prettyPrint and "," or (math.random(1, 2) == 1 and "," or ";");
			if i > 1 and not inlineTable then
				push(sep, self:optionalWhitespace(self:newline() .. self:tabs(tableTabbing)));
			elseif i > 1 then
				push(sep, self:optionalWhitespace());
			end
			if(entry.kind == AstKind.KeyedTableEntry) then
				if(entry.key.kind == AstKind.StringExpression and self:isValidIdentifier(entry.key.value)) then
					push(entry.key.value);
				else
					push("[", self:unparseExpression(entry.key, tableTabbing), "]");
				end
				push(self:optionalWhitespace(), "=", self:optionalWhitespace(), self:unparseExpression(entry.value, tableTabbing));
			else
				push(self:unparseExpression(entry.value, tableTabbing));
			end
		end

		if inlineTable then
			return joinParts(parts) .. self:optionalWhitespace() .. "}";
		end

		return joinParts(parts) .. self:optionalWhitespace((p and "," or "") .. self:newline() .. self:tabs(tabbing)) .. "}";
	end

	if (self.luaVersion == LuaVersion.LuaU) then
		k = AstKind.IfElseExpression
		if(expression.kind == k) then
			push("if ");
			push(self:unparseExpression(expression.condition));
			push(" then ");
			push(self:unparseExpression(expression.true_value));
			for _, elseifexp in pairs(expression.elseifs) do
				push(" elseif ");
				push(self:unparseExpression(elseifexp.condition));
				push(" then ");
				push(self:unparseExpression(elseifexp.value));
			end
			push(" else ");
			push(self:unparseExpression(expression.false_value));
			return joinParts(parts);
		end
	end

	logger:error(string.format("\\"%s\\" is not a valid unparseable expression", expression.kind));
end

return Unparser
`,"prometheus.util":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- util.lua
--
-- This Script provides some utility functions for Prometheus.

local function lookupify(tb)
	local tb2 = {};
	for _, v in ipairs(tb) do
		tb2[v] = true
	end
	return tb2
end

local function unlookupify(tb)
	local tb2 = {};
	for v, _ in pairs(tb) do
		table.insert(tb2, v);
	end
	return tb2;
end

local function escape(str)
	return str:gsub(".", function(char)
		local byte = string.byte(char)
		if byte >= 32 and byte <= 126 and char ~= "\\\\" and char ~= "\\"" and char ~= "\\'" then
			return char
		end
		if(char == "\\\\") then
			return "\\\\\\\\";
		end
		if(char == "\\n") then
			return "\\\\n";
		end
		if(char == "\\r") then
			return "\\\\r";
		end
		if(char == "\\"") then
			return "\\\\\\"";
		end
		if(char == "\\'") then
			return "\\\\\\'";
		end
		return string.format("\\\\%03d", byte);
	end)
end

local function chararray(str)
	local tb = {};
	for i = 1, str:len(), 1 do
		table.insert(tb, str:sub(i, i));
	end
	return tb;
end

local function keys(tb)
	local keyset = {}
	local n=0
	for k, _ in pairs(tb) do
		n = n + 1
		keyset[n] = k
	end
	return keyset
end

local utf8char;
do
	local string_char = string.char
	function utf8char(cp)
	  if cp < 128 then
		return string_char(cp)
	  end
	  local suffix = cp % 64
	  local c4 = 128 + suffix
	  cp = (cp - suffix) / 64
	  if cp < 32 then
		return string_char(192 + cp, c4)
	  end
	  suffix = cp % 64
	  local c3 = 128 + suffix
	  cp = (cp - suffix) / 64
	  if cp < 16 then
		return string_char(224 + cp, c3, c4)
	  end
	  suffix = cp % 64
	  cp = (cp - suffix) / 64
	  return string_char(240 + cp, 128 + suffix, c3, c4)
	end
  end

local function shuffle(tb)
	for i = #tb, 2, -1 do
		local j = math.random(i)
		tb[i], tb[j] = tb[j], tb[i]
	end
	return tb
end

local function readonly(obj)
	local r = newproxy(true);
	getmetatable(r).__index = obj;
	return r;
end

return {
	lookupify = lookupify,
	unlookupify = unlookupify,
	escape = escape,
	chararray = chararray,
	keys = keys,
	shuffle = shuffle,
	utf8char = utf8char,
	readonly = readonly
}
`,"prometheus.visitast":`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- visitast.lua
--
-- This Script provides a utility function for visiting each node of an AST.

local Ast = require("prometheus.ast");
local util = require("prometheus.util");

local AstKind = Ast.AstKind;
local lookupify = util.lookupify;

local visitAst, visitBlock, visitStatement, visitExpression;

function visitAst(ast, previsit, postvisit, data)
	ast.isAst = true;
	data = data or {};
	data.scopeStack = {};
	data.functionData = {
		depth = 0;
		scope = ast.body.scope;
		node = ast;
	};
	data.scope = ast.globalScope;
	data.globalScope = ast.globalScope;
	if(type(previsit) == "function") then
		local node, skip = previsit(ast, data);
		ast = node or ast;
		if skip then
			return ast;
		end
	end

	-- Is Function Block because global scope is treated like a Function
	visitBlock(ast.body, previsit, postvisit, data, true);

	if(type(postvisit) == "function") then
		ast = postvisit(ast, data) or ast;
	end
	return ast;
end

local compundStats = lookupify{
	AstKind.CompoundAddStatement,
	AstKind.CompoundSubStatement,
	AstKind.CompoundMulStatement,
	AstKind.CompoundDivStatement,
	AstKind.CompoundModStatement,
	AstKind.CompoundPowStatement,
	AstKind.CompoundConcatStatement,
}

function visitBlock(block, previsit, postvisit, data, isFunctionBlock)
	block.isBlock = true;
	block.isFunctionBlock = isFunctionBlock or false;
	data.scope = block.scope;
	local parentBlockData = data.blockData;
	data.blockData = {};
	table.insert(data.scopeStack, block.scope);
	if(type(previsit) == "function") then
		local node, skip = previsit(block, data);
		block = node or block;
		if skip then
			data.scope = table.remove(data.scopeStack);
			return block
		end
	end

	local i = 1;
	while i <= #block.statements do
		local statement = table.remove(block.statements, i);
		i = i - 1;
		local returnedStatements = {visitStatement(statement, previsit, postvisit, data)};
		for j, statement in ipairs(returnedStatements) do
			i = i + 1;
			table.insert(block.statements, i, statement);
		end
		i = i + 1;
	end

	if(type(postvisit) == "function") then
		block = postvisit(block, data) or block;
	end
	data.scope = table.remove(data.scopeStack);
	data.blockData = parentBlockData;
	return block;
end

function visitStatement(statement, previsit, postvisit, data)
	statement.isStatement = true;
	if(type(previsit) == "function") then
		local node, skip = previsit(statement, data);
		statement = node or statement;
		if skip then
			return statement;
		end
	end

	-- Visit Child Nodes of Statement
	if(statement.kind == AstKind.ReturnStatement) then
		for i, expression in ipairs(statement.args) do
			statement.args[i] = visitExpression(expression, previsit, postvisit, data);
		end
	elseif(statement.kind == AstKind.PassSelfFunctionCallStatement or statement.kind == AstKind.FunctionCallStatement) then
		statement.base = visitExpression(statement.base, previsit, postvisit, data);
		for i, expression in ipairs(statement.args) do
			statement.args[i] = visitExpression(expression, previsit, postvisit, data);
		end
	elseif(statement.kind == AstKind.AssignmentStatement) then
		for i, primaryExpr in ipairs(statement.lhs) do
			statement.lhs[i] = visitExpression(primaryExpr, previsit, postvisit, data);
		end
		for i, expression in ipairs(statement.rhs) do
			statement.rhs[i] = visitExpression(expression, previsit, postvisit, data);
		end
	elseif(statement.kind == AstKind.FunctionDeclaration or statement.kind == AstKind.LocalFunctionDeclaration) then
		local parentFunctionData = data.functionData;
		data.functionData = {
			depth = parentFunctionData.depth + 1;
			scope = statement.body.scope;
			node = statement;
		};
		statement.body = visitBlock(statement.body, previsit, postvisit, data, true);
		data.functionData = parentFunctionData;
	elseif(statement.kind == AstKind.DoStatement) then
		statement.body = visitBlock(statement.body, previsit, postvisit, data, false);
	elseif(statement.kind == AstKind.WhileStatement) then
		statement.condition = visitExpression(statement.condition, previsit, postvisit, data);
		statement.body = visitBlock(statement.body, previsit, postvisit, data, false);
	elseif(statement.kind == AstKind.RepeatStatement) then
		statement.body = visitBlock(statement.body, previsit, postvisit, data);
		statement.condition = visitExpression(statement.condition, previsit, postvisit, data);
	elseif(statement.kind == AstKind.ForStatement) then
		statement.initialValue = visitExpression(statement.initialValue, previsit, postvisit, data);
		statement.finalValue = visitExpression(statement.finalValue, previsit, postvisit, data);
		statement.incrementBy = visitExpression(statement.incrementBy, previsit, postvisit, data);
		statement.body = visitBlock(statement.body, previsit, postvisit, data, false);
	elseif(statement.kind == AstKind.ForInStatement) then
		for i, expression in ipairs(statement.expressions) do
			statement.expressions[i] = visitExpression(expression, previsit, postvisit, data);
		end
		statement.body = visitBlock(statement.body, previsit, postvisit, data, false);
	elseif(statement.kind == AstKind.IfStatement) then
		statement.condition = visitExpression(statement.condition, previsit, postvisit, data);
		statement.body = visitBlock(statement.body, previsit, postvisit, data, false);
		for i, eif in ipairs(statement.elseifs) do
			eif.condition = visitExpression(eif.condition, previsit, postvisit, data);
			eif.body = visitBlock(eif.body, previsit, postvisit, data, false);
		end
		if(statement.elsebody) then
			statement.elsebody = visitBlock(statement.elsebody, previsit, postvisit, data, false);
		end
	elseif(statement.kind == AstKind.LocalVariableDeclaration) then
		for i, expression in ipairs(statement.expressions) do
			statement.expressions[i] = visitExpression(expression, previsit, postvisit, data);
		end
	elseif compundStats[statement.kind] then
		statement.lhs = visitExpression(statement.lhs, previsit, postvisit, data);
		statement.rhs = visitExpression(statement.rhs, previsit, postvisit, data);
	end

	if(type(postvisit) == "function") then
		local statements = {postvisit(statement, data)};
		if #statements > 0 then
			return unpack(statements);
		end
	end

	return statement;
end

local binaryExpressions = lookupify{
	AstKind.OrExpression,
	AstKind.AndExpression,
	AstKind.LessThanExpression,
	AstKind.GreaterThanExpression,
	AstKind.LessThanOrEqualsExpression,
	AstKind.GreaterThanOrEqualsExpression,
	AstKind.NotEqualsExpression,
	AstKind.EqualsExpression,
	AstKind.StrCatExpression,
	AstKind.AddExpression,
	AstKind.SubExpression,
	AstKind.MulExpression,
	AstKind.DivExpression,
	AstKind.ModExpression,
	AstKind.PowExpression,
}
function visitExpression(expression, previsit, postvisit, data)
	expression.isExpression = true;
	if(type(previsit) == "function") then
		local node, skip = previsit(expression, data);
		expression = node or expression;
		if skip then
			return expression;
		end
	end

	if(binaryExpressions[expression.kind]) then
		expression.lhs = visitExpression(expression.lhs, previsit, postvisit, data);
		expression.rhs = visitExpression(expression.rhs, previsit, postvisit, data);
	end

	if(expression.kind == AstKind.NotExpression or expression.kind == AstKind.NegateExpression or expression.kind == AstKind.LenExpression) then
		expression.rhs = visitExpression(expression.rhs, previsit, postvisit, data);
	end

	if(expression.kind == AstKind.PassSelfFunctionCallExpression or expression.kind == AstKind.FunctionCallExpression) then
		expression.base = visitExpression(expression.base, previsit, postvisit, data);
		for i, arg in ipairs(expression.args) do
			expression.args[i] = visitExpression(arg, previsit, postvisit, data);
		end
	end

	if(expression.kind == AstKind.FunctionLiteralExpression) then
		local parentFunctionData = data.functionData;
		data.functionData = {
			depth = parentFunctionData.depth + 1;
			scope = expression.body.scope;
			node = expression;
		};
		expression.body = visitBlock(expression.body, previsit, postvisit, data, true);
		data.functionData = parentFunctionData;
	end

	if(expression.kind == AstKind.TableConstructorExpression) then
		for i, entry in ipairs(expression.entries) do
			if entry.kind == AstKind.KeyedTableEntry then
				entry.key = visitExpression(entry.key, previsit, postvisit, data);
			end
			entry.value = visitExpression(entry.value, previsit, postvisit, data);
		end
	end

	if(expression.kind == AstKind.IndexExpression or expression.kind == AstKind.AssignmentIndexing) then
		expression.base = visitExpression(expression.base, previsit, postvisit, data);
		expression.index = visitExpression(expression.index, previsit, postvisit, data);
	end
	if(expression.kind == AstKind.IfElseExpression) then
		expression.condition = visitExpression(expression.condition, previsit, postvisit, data);
		expression.true_value = visitExpression(expression.true_value, previsit, postvisit, data);
		for i, elif in pairs(expression.elseifs) do
			elif.condition = visitExpression(elif.condition, previsit, postvisit, data);
			elif.value = visitExpression(elif.value, previsit, postvisit, data);
		end
		expression.false_value = visitExpression(expression.false_value, previsit, postvisit, data);
	end

	if(type(postvisit) == "function") then
		expression = postvisit(expression, data) or expression;
	end
	return expression;
end

return visitAst;
`,prometheus:`-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- prometheus.lua
--
-- This file is the entrypoint for Prometheus

-- Configure package.path for require
local function script_path()
	local str = debug.getinfo(2, "S").source:sub(2)
	return str:match("(.*[/%\\\\])")
end

local oldPkgPath = package.path;
package.path = script_path() .. "?.lua;" .. package.path;

-- Math.random Fix for Lua5.1
-- Check if fix is needed
if not pcall(function()
    return math.random(1, 2^40);
end) then
    local oldMathRandom = math.random;
    math.random = function(a, b)
        if not a and b then
            return oldMathRandom();
        end
        if not b then
            return math.random(1, a);
        end
        if a > b then
            a, b = b, a;
        end
        local diff = b - a;
        assert(diff >= 0);
        if diff > 2 ^ 31 - 1 then
            return math.floor(oldMathRandom() * diff + a);
        else
            return oldMathRandom(a, b);
        end
    end
end

-- newproxy polyfill
_G.newproxy = _G.newproxy or function(arg)
    if arg then
        return setmetatable({}, {});
    end
    return {};
end


-- Require Prometheus Submodules
local Pipeline = require("prometheus.pipeline");
local highlight = require("highlightlua");
local colors = require("colors");
local Logger = require("logger");
local Presets = require("presets");
local Config = require("config");
local util = require("prometheus.util");

-- Restore package.path
package.path = oldPkgPath;

-- Export
return {
    Pipeline = Pipeline;
    colors = colors;
    Config = util.readonly(Config); -- Readonly
    Logger = Logger;
    highlight = highlight;
    Presets = Presets;
}

`};function d(e){let t=``;for(;e.includes(`]${t}]`);)t+=`=`;return`[${t}[${e}]${t}]`}let f=null;function p(e){if(typeof process<`u`&&process.versions?.node){let t=e.startsWith(`/@fs/`)?e.slice(4):e;if(t.startsWith(`file://`))try{return new URL(t).pathname.replace(/^\/([A-Za-z]:)/,`$1`)}catch{}return t=t.replace(/^\/([A-Za-z]:)/,`$1`),t}return e}async function m(){return f||(f=import(`./dist-DFPmf7qJ.js`).then(e=>c(e.default,1)).then(e=>{let t=globalThis.wasmoon?.LuaFactory,n=e.LuaFactory,r=e.default?.LuaFactory,i=t??n??r;if(typeof i!=`function`)throw Error(`Unable to resolve LuaFactory export from wasmoon.`);return i}),f)}const h=Object.entries(u).map(([e,t])=>{let n=`@/src/${e.split(`.`).join(`/`)}.lua`;return`
package.preload[ ${d(e)} ] = function(...)
  local chunk, err = load(${d(t)}, ${d(n)}, "t")
  if not chunk then
    error(err)
  end
  return chunk(...)
end`}).join(`
`);function g(e){return`
_G.arg = _G.arg or {}
${h}

local logs = {}
local unpackFn = table.unpack or unpack
local function pushLog(level, ...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[#parts + 1] = tostring(select(i, ...))
  end
  if type(_G.__prometheusPushLog) == "function" then
    _G.__prometheusPushLog(level, unpackFn(parts))
  end
  logs[#logs + 1] = { level = level, message = table.concat(parts, " ") }
end

if not math.log10 then
  math.log10 = function(value)
    return math.log(value, 10)
  end
end

local Prometheus = require("prometheus")
Prometheus.Logger.logLevel = Prometheus.Logger.LogLevel.Info
Prometheus.colors.enabled = false
Prometheus.Logger.debugCallback = function(...) pushLog("debug", ...) end
Prometheus.Logger.logCallback = function(...) pushLog("info", ...) end
Prometheus.Logger.warnCallback = function(...) pushLog("warn", ...) end
Prometheus.Logger.errorCallback = function(...)
  pushLog("error", ...)
  error(table.concat((function(...)
    local parts = {}
    for i = 1, select("#", ...) do
      parts[#parts + 1] = tostring(select(i, ...))
    end
    return parts
  end)(...), " "))
end

local ok, outputOrError = xpcall(function()
  local preset = ${d(e.preset)}
  local source = ${d(e.source)}
  local filename = ${d(e.filename)}
  local config = {}
  for key, value in pairs(Prometheus.Presets[preset]) do
    config[key] = value
  end

  config.LuaVersion = ${d(e.luaVersion)}
  if config.LuaVersion == "LuaU" then
    -- Keep Roblox API strings intact and omit transformations that corrupt or break Luau.
    local incompatibleSteps = {
      Vmify = true,
      AntiTamper = true,
      EncryptStrings = true,
      ConstantArray = true,
    }
    local compatibleSteps = {}
    for _, step in ipairs(config.Steps or {}) do
      if not incompatibleSteps[step.Name] then
        compatibleSteps[#compatibleSteps + 1] = step
      end
    end
    config.Steps = compatibleSteps
    -- Split string literals using native concatenation so Luau needs no decoder helper.
    table.insert(config.Steps, {
      Name = "SplitStrings",
      Settings = {
        Threshold = 1,
        MinLength = 2,
        MaxLength = ${e.expandedTransforms === true ? `3` : `5`},
        ConcatenationType = "strcat",
      },
    })
    if ${e.tamperCheck === true ? `true` : `false`} then
      table.insert(config.Steps, {
        Name = "WatermarkCheck",
        Settings = { Content = "VoidedX:" .. tostring(config.Seed) },
      })
    end
  end
  if config.LuaVersion == "LuaU" and ${e.preset === "Strong" ? `true` : `false`} then
    -- Keep the stronger numeric representation pass exact for LuaU: avoid
    -- scientific formatting and binary literals, which can change values or fail to parse.
    for _, step in ipairs(config.Steps or {}) do
      if step.Name == "NumbersToExpressions" then
        step.Settings = step.Settings or {}
        step.Settings.NumberRepresentationMutation = true
        step.Settings.AllowedNumberRepresentations = { "hex", "normal" }
      end
    end
  end
  config.PrettyPrint = ${e.prettyPrint?`true`:`false`}
  config.Seed = ${Math.max(1,Math.floor(e.seed))}

  return Prometheus.Pipeline:fromConfig(config):apply(source, filename)
end, debug.traceback)

return { ok = ok, output = ok and outputOrError or "", error = ok and "" or outputOrError, logs = logs }
`}function _(e){return`
local logs = {}
local unpackFn = table.unpack or unpack
local function pushLog(level, ...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[#parts + 1] = tostring(select(i, ...))
  end
  if type(_G.__prometheusPushLog) == "function" then
    _G.__prometheusPushLog(level, unpackFn(parts))
  end
  logs[#logs + 1] = { level = level, message = table.concat(parts, " ") }
end

print = function(...)
  pushLog("info", ...)
end

local ok, err = xpcall(function()
  local chunk, loadErr = load(${d(e.source)}, ${d(e.filename)}, "t")
  if not chunk then
    error(loadErr)
  end
  chunk()
end, debug.traceback)

if not ok then
  pushLog("error", err)
end

return { ok = ok, output = "", error = ok and "" or err, logs = logs }
`}function v(e){return Array.isArray(e)?e.map(e=>{let t=e;return{level:t.level===`warn`||t.level===`error`||t.level===`debug`?t.level:`info`,message:String(t.message??``)}}):[]}async function y(e){let t=[],n=null;try{n=await new(await(m()))(p(l)).createEngine({openStandardLibs:!0});let t=await n.doString(g(e));return t.ok===!1?{ok:!1,error:String(t.error??`Prometheus failed`),logs:v(t.logs)}:{ok:!0,output:String(t.output??``),logs:v(t.logs)}}catch(e){return{ok:!1,error:e instanceof Error?e.message:String(e),logs:t}}finally{n?.global.close()}}async function b(e,t){let n=null;try{n=await new(await(m()))(p(l)).createEngine({openStandardLibs:!0}),t&&n.global.set?.(`__prometheusPushLog`,(e,...n)=>{t({level:e===`warn`||e===`error`||e===`debug`?e:`info`,message:n.map(e=>String(e)).join(` `)})});let r=await n.doString(_(e));return r.ok===!1?{ok:!1,error:String(r.error??`Script execution failed`),logs:v(r.logs)}:{ok:!0,output:String(r.output??``),logs:v(r.logs)}}catch(e){return{ok:!1,error:e instanceof Error?e.message:String(e),logs:[]}}finally{n?.global.close()}}export{c as n,b as runLuaScript,y as runPrometheus,o as t};
