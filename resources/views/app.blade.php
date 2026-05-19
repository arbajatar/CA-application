<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CA Office App</title>
    <link rel="icon" type="image/png" href="{{ asset(env('APP_LOGO', 'CA_LOGO-png.png')) }}">
    @viteReactRefresh
    @vite(['resources/react/main.jsx', 'resources/css/app.css'])
</head>
<body class="antialiased">
    <div id="root"></div>
</body>
</html>
