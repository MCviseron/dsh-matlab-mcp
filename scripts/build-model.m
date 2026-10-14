% Phase 3/4 spike: build a tiny Simulink model, simulate it, and print the
% numeric result. Runs inside MATLAB through the MCP server.
mdl = "dsh_demo_model";
if bdIsLoaded(mdl)
    close_system(mdl, 0);
end
if isfile(mdl + ".slx")
    delete(mdl + ".slx");
end
new_system(mdl);
open_system(mdl);
add_block("simulink/Sources/Constant", mdl + "/Constant", "Value", "3");
add_block("simulink/Math Operations/Gain", mdl + "/Gain", "Gain", "4");
add_block("simulink/Sinks/Out1", mdl + "/Out1");
add_line(mdl, "Constant/1", "Gain/1");
add_line(mdl, "Gain/1", "Out1/1");
set_param(mdl, "StopTime", "1");
save_system(mdl);
out = sim(mdl);
y = out.yout;
if isa(y, "Simulink.SimulationData.Dataset")
    v = y.getElement(1).Values.Data;
else
    v = y(1).Data;
end
disp("DSH_RESULT_LAST=" + v(end));
disp("DSH_RESULT_MIN=" + min(v));
disp("DSH_MODEL_FILE=" + which(mdl + ".slx"));
close_system(mdl, 0);
