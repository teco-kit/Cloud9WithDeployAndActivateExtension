var gpio = require("pi-gpio"),
    on = true,
    intvl;
    
console.log("Start!");

gpio.open(18, "output", function(err) {
    
    intvl = setInterval(function () {
        gpio.write(18, Number(on));
        on = !on;
    }, 200);
    
    //process.kill(process.pid, "SIGTERM");
});

process.on("SIGTERM", function ()  {
        console.log("End!");
        clearInterval(intvl);
        gpio.write(18, 0, function () {
            gpio.close(18);
            process.exit();
        });
});